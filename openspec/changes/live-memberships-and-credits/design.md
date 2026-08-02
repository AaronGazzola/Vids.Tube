## Context

Chat is scored live: `worker/jobs/score.ts` buffers YouTube and site messages, scores them in batches, and writes `score_events` plus a running per-broadcast `viewer_scores` row. Nothing downstream of that runs live. `memberships` and `membership_stream_stats` only change when `recompute_membership(channel, community)` is called, and today that only happens from `scripts/create-unclaimed-channels.ts`, `merge_youtube_identity`, and the recompute script. The worker never touches either table, and never creates a channel.

`recompute_membership` is already a full rebuild from raw events: it deletes and re-inserts that membership's per-broadcast rows, then re-derives lifetime XP, level, message count, attendance and streaks. It is idempotent by construction and scoped to one membership.

`memberships.credits` exists, defaults to 0, is explicitly preserved by recompute, and is written by nothing. The identity merge sums two balances when profiles combine. So the column is currently dead weight with one merge rule attached to it.

Phase B left the catalogue uniform: 168 broadcasts, every stored YouTube message carrying YouTube's own message id, 148 memberships over 4933 messages. Scoring has only ever run live on a handful of broadcasts, so 145 of 148 memberships hold zero XP until the Phase D backfill.

## Goals / Non-Goals

**Goals:**

- A chatter who has never appeared before gets a channel and a membership within the same scoring batch as their first message.
- A chatter's XP, level, message count, attendance and streaks move during the broadcast they are taking part in.
- Credits are earned from participation and can be spent in the same broadcast.
- A full re-score with a different scoring configuration rebuilds every credit that was earned and touches nothing that was spent.
- Live updates and a from-scratch rebuild produce identical numbers, with no second code path to keep in sync.

**Non-Goals:**

- Defining what a credit buys. The first spending sink is `!tts` under AZ-179; this change only provides the ledger and the spend entry point.
- The scoring configuration itself, or the historical scoring backfill. Both are Phase D.
- Any UI for viewing credits or memberships beyond the existing channel page. The membership display work is a separate change.
- Changing how XP or level are calculated. Both formulas stay exactly as they are.

## Decisions

### Live updates call the existing rebuild rather than incrementing

After each scoring batch, the worker calls `recompute_membership` once per participant in that batch.

The obvious alternative is to add the batch's points to the membership row and to the per-broadcast row. That is faster per call, but it creates a second way of arriving at the same numbers, and the two drift the moment either is wrong. Because `recompute_membership` already rebuilds one membership from raw events and is idempotent, calling it live means live and rebuilt values cannot disagree — they are produced by the same function.

Cost is acceptable and bounded: a batch has a handful of distinct participants, batches are seconds apart, and each call is a small number of queries scoped to one membership plus a streak scan over the community's ended broadcasts (168 rows today). A 2-hour broadcast with 10 active chatters produces on the order of a few thousand calls, each cheap.

If this ever becomes a bottleneck, the fix is to debounce per participant, not to introduce an incremental path.

### The chatter's channel is created in the ingest loop, before scoring

The ingest loop already resolves each message's author. When the author's YouTube account has no channel and no retired profile pointing at one, a channel is created there and then, followed immediately by `recompute_membership`, which creates the membership because the chatter now has history in the community.

Creation must sit before the message reaches the scoring buffer, so that by the time the batch scores and recomputes, the membership exists.

The host is excluded, as are bots. Both already `continue` before the scoring buffer in the ingest loop; channel creation goes after those guards so neither can be onboarded as a chatter.

### Enrichment mode is a per-channel setting, defaulting to full

`channels.chatter_enrichment_mode` is either `full` or `deferred`, defaulting to `full`, and is edited from the `/live` settings tab. The setting is per channel rather than per broadcast because it describes how a community wants its chatters handled, not a property of one session — and the settings tab already edits channel-level things (commands, projects) alongside broadcast-level ones.

In `full` mode the worker calls YouTube for the chatter's real handle and high-resolution avatar before inserting the channel, matching what the batch job does today. This costs one quota unit per new chatter and one round trip inside the ingest loop.

In `deferred` mode the channel is created from what the chat message already carries — display name and the low-resolution avatar URL — and a post-broadcast pass batches the real handles and avatars. Nothing blocks on YouTube during the broadcast.

`full` is the default because a correct-looking profile from the first message is the better experience, and a single-chatter lookup is fast. `deferred` exists for a busy broadcast or a YouTube outage, where blocking ingest is the worse failure.

Handle generation is shared between the live path and the batch job so both produce the same collision-free handles.

### Credits become a ledger, and earnings are one line per membership

A new `credit_entries` table carries `membership_id`, `amount` (signed), `kind`, `source_id`, and `created_at`. The balance is `sum(amount)`.

Earnings are not one line per message. `recompute_membership` maintains exactly one earning line per membership, rewritten to `floor(lifetime_xp / 10)` on every recompute. That keeps the ledger small, makes the earning side a pure function of XP, and means a re-score with a different configuration simply rewrites that one line.

Spends are one line each, written when a paid command runs, and are never touched by recompute. Because earnings are a single rewritten line and spends are separate rows, `sum(amount)` after a re-score reflects the new earning total minus everything already spent, which is exactly the required behaviour.

The alternative — keeping `credits` as a mutable balance and adjusting it on each recompute — cannot distinguish earned from spent, so a re-score either wipes spends or hands them back.

`memberships.credits` is kept as a materialised copy of the balance, rewritten by the same routine that writes the earning line, so existing readers keep working and no query needs to sum the ledger at read time. The ledger stays the source of truth; the column is a cache.

The divisor of 10 lives in one SQL function, so changing the earning rate is a one-line migration plus a recompute of every membership.

### The identity merge sums ledgers instead of balances

Today the merge adds the two `credits` values together. With a ledger, the merge re-points the losing membership's spending lines at the survivor and lets the next recompute rewrite the earning line from the pooled XP. Summing two earning lines would double-count, because the survivor's XP already includes the merged history.

## Risks / Trade-offs

- **A recompute per participant per batch adds database load during a live broadcast** → Calls are scoped to one membership and batched participants are few. If a broadcast is large enough to matter, debounce so each participant is recomputed at most once every N seconds; the values converge either way because the function is a rebuild.
- **`full` enrichment mode puts a YouTube call inside the ingest loop** → A failed or slow lookup must fall back to the `deferred` behaviour for that chatter rather than dropping the message or stalling the poll. The chatter is then picked up by the post-broadcast enrichment pass.
- **A burst of unknown chatters in `full` mode spends quota one unit at a time** → The setting exists precisely for this; the owner can switch to `deferred` for a broadcast expecting a crowd.
- **Keeping `memberships.credits` as a cache means two places state the balance** → The cache is only ever written by the same routine that writes the earning line, and a verification script asserts the column equals the ledger sum for every membership.
- **A spend written during a broadcast could race a recompute in the same moment** → Spends and earnings are separate rows, so a recompute rewriting the earning line cannot lose a concurrently inserted spend. Only the cached column can go briefly stale, and the next recompute corrects it.
- **Existing memberships have no earning lines** → A one-off derivation writes one earning line per membership from current XP. With 145 of 148 memberships at zero XP, almost every line will be zero until the Phase D backfill, which is expected rather than a fault.

## Migration Plan

1. Add the ledger table, the enrichment-mode column, and the earning-rate function.
2. Change `recompute_membership` to write the earning line and the cached balance.
3. Derive earning lines for all 148 existing memberships by recomputing every membership.
4. Ship the worker changes behind no flag: live creation and live recompute are strictly additive, since nothing depended on memberships being stale.
5. The settings switch ships with the default that matches today's batch behaviour, so nothing changes for the owner until they choose otherwise.

Rollback is a migration that drops the ledger table and restores the previous `recompute_membership`; the cached `credits` column survives untouched, holding the last derived value.
