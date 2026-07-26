## Context

Current schema (see `supabase/migrations/`):

- `channels`: `owner_user_id uuid NOT NULL UNIQUE → auth.users`, `slug`/`handle` (unique, `^[a-z0-9_]{3,30}$`), `name`, `description`, `avatar_path`, `banner_path`. One claimed channel per user.
- Identity in raw events is split by origin. Vids.Tube chatters are `user_id`; YouTube chatters are `origin='youtube'` + `external_author_id` (the YouTube channel id). `viewer_scores.participant_key` is a stored generated column: `coalesce(user_id::text, origin || ':' || external_author_id)`. The command/interaction tables (`command_events`, `tts_requests`, `ask_requests`, `clip_markers`, `banned_participants`) store `participant_key` as plain text in the same format.
- The YouTube back-catalog is fully archived: `youtube_chat_archive` (raw, keyed by `author_channel_id`) and mirrored into `chat_messages` under synthetic `streams` rows by `scripts/import-youtube-vods.ts`, so `chat_messages` alone is a complete pooled event stream across both eras.
- `youtube_links` (user → YouTube channel id, verify-code flow). `worker/lib/verify-links.ts` flips `verified_at` when the code is posted in YouTube chat; nothing else happens today.
- There is exactly one community today (the owner's channel); the model must support many.

## Goals / Non-Goals

**Goals:**

- `channels` as the single identity entity: claimed (owner), unclaimed (YouTube-only), merged (tombstone).
- `memberships` + `membership_stream_stats`: per-community aggregates fully derivable from raw events, except the Credits balance.
- One deterministic recompute routine, one idempotent transactional merge routine.
- Merge wired into the existing verification path; backfill for already-verified links and existing chatters.

**Non-Goals:**

- Mass-creating unclaimed channels for all archived chatters, and the avatar pipeline (AZ-170).
- Claim prompts/banners (AZ-168), slim `!me` (AZ-171), any UI consuming memberships.
- Credits ledger, XP earning changes, streak bonuses, level-gated unlocks (V3). This change only creates the columns and derivation rules.
- Multi-streamer publishing (memberships support N communities structurally; nothing else changes).

## Decisions

### D1 — Channel states via nullable columns, not a state enum

`owner_user_id` becomes nullable; add `youtube_channel_id text` (unique, nullable) and `merged_into_channel_id uuid` (nullable, self-FK). State is derived: claimed = has owner; unclaimed = no owner + has `youtube_channel_id`; merged = `merged_into_channel_id` set. A check constraint requires at least one of the three to be non-null. Alternative considered: explicit `status` enum — rejected because it duplicates information the columns already carry and invites drift.

Tombstones keep their `handle` so existing profile URLs can redirect (resolvers follow `merged_into_channel_id`); their `youtube_channel_id` is cleared because the unique key moves to the survivor.

### D2 — `memberships` holds aggregates; `membership_stream_stats` holds the timeline

`memberships`: `id` PK, `channel_id → channels`, `community_channel_id → channels`, `unique (channel_id, community_channel_id)`, `check (channel_id <> community_channel_id)`, `lifetime_xp bigint`, `level int`, `credits bigint default 0`, `current_streak int`, `best_streak int`, `first_seen_at`, `last_seen_at`, `message_count int`, `streams_attended int`, `rewards jsonb default '[]'` (shape deferred to V3), `created_at`, `updated_at`.

`membership_stream_stats`: `membership_id → memberships (on delete cascade)`, `stream_id → streams`, `xp int`, `message_count int`, `stream_started_at timestamptz`, PK `(membership_id, stream_id)`.

Alternative considered: deriving per-stream history from `viewer_scores` at read time — rejected because streak/lifetime recomputation would then need the full identity-resolution join on every read; materializing it makes recompute the single place that join exists.

### D3 — Derivation rules (the contract)

For a member channel C in community K, C's identity keys are `{owner_user_id::text}` ∪ `{'youtube:' || youtube_channel_id}` (whichever are non-null). Raw-event membership of a stream S (where `S.channel_id = K`):

- **Attended(S)** = C authored ≥1 `chat_messages` row in S.
- **xp(S)** = `greatest(sum(viewer_scores.total_score for C's keys in S), 0)` — 0 when no score rows exist (archive-era streams).
- `lifetime_xp` = Σ xp(S); `level` = `level_for_xp(lifetime_xp)`; `message_count`/`first_seen_at`/`last_seen_at` from C's `chat_messages` in K's streams; `streams_attended` = count of attended streams.
- **Streaks** over K's ended streams ordered by `started_at` (synthetic archive streams included — that attendance was real): `current_streak` = length of the attended run ending at K's most recent ended stream (0 if it wasn't attended); `best_streak` = longest attended run.
- `credits` is NOT derived — it is a balance, only ever adjusted by explicit operations (and summed on merge).

`level_for_xp(xp)` = `floor(sqrt(xp / 100))`, i.e. level 1 at 100 XP, 2 at 400, 3 at 900. The divisor 100 is the single tuning constant; the function is `immutable` so the curve can be re-tuned with a migration + recompute.

### D4 — Recompute and merge live in Postgres functions

`recompute_membership(p_channel_id, p_community_channel_id)` and `merge_youtube_identity(p_user_id)` are SQL functions called via service-role RPC (`EXECUTE` revoked from `anon`/`authenticated`). Rationale: the merge must be one transaction across ~9 tables, and recompute is set-based aggregation — both are natural SQL; the worker, server actions, and backfill script all reuse the same routine. Alternative considered: TypeScript orchestration in the worker — rejected: no transactionality across statements via PostgREST, and three call sites would each need the logic.

`recompute_membership` upserts the membership row (creating it when the identity has any history in K, preserving `credits` and `rewards`), rebuilds `membership_stream_stats` for that membership (delete + insert), and never touches other memberships.

### D5 — Merge algorithm (idempotent, single transaction)

`merge_youtube_identity(p_user_id)`:

1. Read `youtube_links` for `p_user_id`; require `verified_at IS NOT NULL` → `ycid`. No row/unverified → no-op error return.
2. Survivor = channel with `owner_user_id = p_user_id`. None → expected error ("create your channel first").
3. If another **claimed** channel (different owner) already has `youtube_channel_id = ycid` → abort with a conflict error; this is a contested identity and is resolved manually, never automatically.
4. Source = channel with `youtube_channel_id = ycid` and no owner (unclaimed), if any (none exists pre-AZ-170 — then skip to step 8).
5. **Re-key raw events** (`origin='youtube' AND external_author_id = ycid`): set `user_id = p_user_id` on `chat_messages`, `score_events`, `featured_messages` (keep `origin`/`external_author_id` as provenance).
6. **Rebuild collided aggregates**: for every stream where either identity has `viewer_scores` rows, delete both identities' rows and re-insert one row per stream aggregated from the re-keyed `score_events` (`total_score = sum(points)`) and `featured_messages` (`features_count = count`, `last_featured_at = max`). Never `total_score_a + total_score_b` from the old rows — always re-aggregate from events.
7. **Re-key text participant keys**: `'youtube:' || ycid` → `p_user_id::text` in `command_events`, `tts_requests`, `ask_requests`, `clip_markers`. For `banned_participants` (unique per channel × key): if both identities have a row for the same channel, keep the earliest-created ban and delete the other; otherwise re-key in place — a ban follows the person.
8. **Memberships**: for each community where the source channel has a membership and the survivor also has one, add the source's `credits` into the survivor's before deleting the source row (union of `rewards` arrays likewise). Delete all source memberships (stream stats cascade). Then `recompute_membership(survivor, K)` for every community K where either identity has history.
9. **Identity move**: clear `youtube_channel_id` on the source, set `merged_into_channel_id = survivor.id`; set `youtube_channel_id = ycid` on the survivor. (When no source existed, just set the survivor's `youtube_channel_id`.)

Idempotency: a second run finds no `'youtube:ycid'` rows left and the survivor already holding `ycid`; every step is a no-op.

### D6 — Trigger point and backfill

`worker/lib/verify-links.ts` calls `merge_youtube_identity` (RPC) immediately after flipping `verified_at`, logging failures with `console.error` without blocking the batch. `scripts/backfill-memberships.ts` (one-time, service role, same pattern as the existing backfill scripts): run `merge_youtube_identity` for every already-verified `youtube_links` row, then `recompute_membership` against the owner community for every channel whose identity keys appear in that community's raw events.

### D7 — RLS

`memberships` and `membership_stream_stats`: public `SELECT` (`using (true)` — these power public profiles and overlays), no client write policies (service role only). `channels` policies are unchanged — unclaimed/merged rows are already publicly readable, owner-scoped write policies simply never match ownerless rows; unclaimed-channel creation (AZ-170) will use the service role.

## Risks / Trade-offs

- [Merge re-keys shared tables while the worker is live-writing scores] → the merge is a single transaction; the worker's writes key on `participant_key`/`external_author_id` values that remain valid before and after (old-key rows written concurrently are caught by the idempotent re-run in the backfill, and each subsequent recompute self-heals). Verification happens mid-stream by design, so step 6's per-stream rebuild only touches the affected identity's streams, not the whole table.
- [`viewer_scores.participant_key` is a stored generated column] → updating `user_id` on youtube-origin rows would regenerate keys and can collide with the PK mid-statement; that's why D5 step 6 deletes-then-rebuilds instead of updating in place.
- [Level curve or XP mapping may be re-tuned later] → both live in one `immutable` function / one derivation rule; a migration + full recompute re-derives every membership deterministically.
- [Tombstone channels retain handles] → a claimed user keeps their own handle; the unclaimed channel's handle stays reserved by the tombstone. Acceptable: redirects preserve shared URLs, and handle release can be a later cleanup.
- [`streams_attended`/streaks depend on synthetic archive streams having accurate `started_at`] → the VOD import already sets stream timing from YouTube publish dates; ordering is what matters, exact timestamps are not.

## Migration Plan

1. One migration: alter `channels`, create `memberships` + `membership_stream_stats`, create `level_for_xp`, `recompute_membership`, `merge_youtube_identity`, RLS + grants.
2. `npx supabase db push`, regenerate types.
3. Deploy worker change (merge call on verification).
4. Run `scripts/backfill-memberships.ts` once against the owner community.

Rollback: the functions and new tables are additive; dropping them restores prior behavior. The `channels` alterations are backward-compatible (existing rows all remain claimed). Re-keyed event rows keep `origin`/`external_author_id`, so identity re-derivation remains possible even after merges.

## Open Questions

None blocking. Two tunables intentionally parameterized rather than debated now: the `level_for_xp` divisor (100) and whether archive-era XP should ever be granted retroactively (currently: archive streams contribute attendance but 0 XP, since no scoring ran).
