# Tasks: live memberships and credit ledger

## 1. Database: the credit ledger

- [x] 1.1 New migration: create `public.credit_entries` with `id uuid primary key
  default gen_random_uuid()`, `membership_id uuid not null references
  public.memberships(id) on delete cascade`, `amount bigint not null`, `kind text
  not null`, `source_id text`, `created_at timestamptz not null default now()`,
  `updated_at timestamptz not null default now()`. Index on `membership_id`.
  Partial unique index on `(membership_id)` where `kind = 'earned'`, so a
  membership can hold at most one earning line.
- [x] 1.2 In the same migration, enable row level security on `credit_entries`,
  grant select to `anon` and `authenticated`, and revoke insert/update/delete
  from both, matching the pattern used by `memberships`.
- [x] 1.3 Add `public.credits_for_xp(xp bigint) returns bigint`, `language sql`,
  `immutable`, returning `greatest(floor(xp / 10), 0)::bigint`. The divisor lives
  only here.
- [x] 1.4 Add `public.membership_credit_balance(p_membership_id uuid) returns
  bigint`, `language sql`, `stable`, returning
  `coalesce(sum(amount), 0)` over that membership's `credit_entries`.

## 2. Database: recompute writes the earning line

- [x] 2.1 In the same migration, replace `public.recompute_membership` so that
  after it writes `lifetime_xp`, it upserts the membership's `kind = 'earned'`
  line to `credits_for_xp(v_lifetime)` using the partial unique index as the
  conflict target, then sets `memberships.credits` to
  `membership_credit_balance(v_membership_id)`.
- [x] 2.2 Confirm by reading the replaced function that it never touches a row
  whose `kind` is not `earned`, so spending lines cannot be altered by a
  recompute.
- [x] 2.3 Replace `public.merge_youtube_identity` so that, where it currently
  sums the two `credits` values, it instead re-points the losing membership's
  non-`earned` `credit_entries` rows onto the surviving membership and deletes
  the losing membership's `earned` line. The recompute that already runs at the
  end of the merge re-derives the survivor's earning line from pooled XP.
- [x] 2.4 Add `public.spend_credits(p_membership_id uuid, p_amount bigint, p_kind
  text, p_source_id text) returns jsonb`, `security definer`, `search_path =
  public`. It SHALL reject a non-positive `p_amount`, reject `p_kind` of
  `earned`, return `{"spent": false, "reason": "insufficient", "balance": n}`
  when the balance is below `p_amount`, and otherwise insert a line of
  `-p_amount`, refresh `memberships.credits`, and return `{"spent": true,
  "balance": n}`. Revoke execute from `anon` and `authenticated`.
- [x] 2.5 Push the migration with `npx supabase db push` and regenerate
  `supabase/types.ts`.

## 3. Database: the enrichment setting

- [x] 3.1 In the same migration, add `channels.chatter_enrichment_mode text not
  null default 'full'` with a check constraint allowing only `full` and
  `deferred`, and `channels.awaiting_enrichment boolean not null default false`.
- [x] 3.2 Add a partial index on `channels (awaiting_enrichment)` where
  `awaiting_enrichment` is true, so the post-broadcast pass can find its work
  without scanning every channel.

## 4. Shared handle generation

- [x] 4.1 Create `lib/channel-handle.ts` exporting `normalizeHandleBase(source:
  string): string` and `ensureUniqueHandle(base: string, taken: Set<string>):
  string`, moved verbatim in behaviour from the equivalents in
  `scripts/create-unclaimed-channels.ts`, including the reserved-word list and
  the 3-to-30 character bounds.
- [x] 4.2 Change `scripts/create-unclaimed-channels.ts` to import both from
  `lib/channel-handle.ts` and delete its local copies.
- [x] 4.3 Add `tests/unit/channel-handle.test.ts` asserting: a display name with
  spaces and punctuation normalises within bounds; a colliding base gets a
  suffixed variant that stays within 30 characters; a reserved word is not
  returned; the same input produces the same output on repeated calls.

## 5. Worker: onboarding an unknown chatter

- [x] 5.1 Add `worker/lib/chatter-onboarding.ts` exporting
  `ensureChatterChannel({ authorChannelId, authorName, avatarUrl, communityId,
  mode })` returning the channel id. It SHALL return the existing channel when
  one holds that `youtube_channel_id`, SHALL follow `merged_into_channel_id` to
  the survivor when the channel is retired, and SHALL otherwise create a channel
  using `lib/channel-handle.ts`.
- [x] 5.2 In that module, `full` mode SHALL call the existing YouTube
  `channels.list` snippet helper for the single account and cache the avatar
  exactly as `scripts/create-unclaimed-channels.ts` does, then create the channel
  with the real handle, name and cached avatar, leaving `awaiting_enrichment`
  false.
- [x] 5.3 In that module, `deferred` mode SHALL create the channel from
  `authorName` and the message's `avatarUrl` with no external call, and SHALL set
  `awaiting_enrichment` to true.
- [x] 5.4 In that module, a thrown or failed lookup in `full` mode SHALL be
  logged with `console.error` and fall through to the `deferred` path for that
  chatter, so ingest never stalls and the chatter is picked up later.
- [x] 5.5 After creating a channel, call `recompute_membership(channelId,
  communityId)` so the membership exists before the message is scored.
- [x] 5.6 Add `resolveEnrichmentMode(channel)` to `worker/lib/streams.ts`
  returning the community channel's `chatter_enrichment_mode`, defaulting to
  `full` when absent.

## 6. Worker: wiring onboarding into ingest

- [x] 6.1 In `worker/jobs/score.ts` `consumeYoutube`, resolve the enrichment mode
  once before the poll loop.
- [x] 6.2 For each stored message, after the existing bot and host `continue`
  guards and before `ytBuffer.push`, call `ensureChatterChannel` for the author.
  Neither the host nor a bot SHALL reach this call.
- [x] 6.3 Hold a `Set` of author ids already onboarded during this broadcast and
  skip the call for anyone in it, so onboarding costs one attempt per account per
  broadcast.
- [x] 6.4 Site-origin messages need no onboarding step: a signed-in user cannot
  reach an authenticated area without owning a channel (`channel-onboarding`
  gates on it), so every site sender already has one. Their membership is
  refreshed through the owned-channel lookup in `refreshBatchMemberships`.

## 7. Worker: refreshing memberships each batch

- [x] 7.1 In `worker/jobs/score.ts`, after the block that writes `viewer_scores`
  for the batch's participants, resolve each participant to a channel id (the
  chatter channel for a YouTube participant, the owned channel for a site
  participant) and call `recompute_membership(channelId, communityId)` once per
  distinct participant.
- [x] 7.2 Log a `console.error` and continue when a single recompute fails, so
  one bad participant cannot stop the batch.
- [x] 7.3 Bots never reach the scoring buffer (`if (m.isBot) continue` precedes
  `ytBuffer.push`), so they cannot appear as participants. The host resolves to
  the community channel, because the merge wrote the community's
  `youtube_channel_id`, and `refreshBatchMemberships` skips a participant whose
  channel is the community itself.

## 8. Settings UI

- [x] 8.1 Add `chatterEnrichment: boolean` to the settings tab's form state in
  `app/(app)/live/settings-tab.tsx`, rendered with the existing `SwitchRow`
  beside the waiting-room switch, labelled "Fetch chatter profiles immediately"
  with a one-line description of the trade-off.
- [x] 8.2 Extend the channel-settings save path in
  `app/(app)/live/broadcast.actions.ts` to persist the switch to
  `channels.chatter_enrichment_mode` as `full` or `deferred`, following the
  expected-vs-unexpected error split in CLAUDE.md.
- [x] 8.3 Load the current value into the settings tab so the switch reflects the
  stored mode on mount.

## 9. Post-broadcast enrichment pass

- [x] 9.1 Create `scripts/enrich-chatter-channels.ts` that selects channels where
  `awaiting_enrichment` is true, batches them through the existing YouTube
  `channels.list` snippet helper, writes the real handle, name and cached
  avatar, and clears the flag. Dry-run by default, `--apply` to write.
- [x] 9.2 Leave `awaiting_enrichment` true for any channel whose lookup returned
  nothing, and print how many were left for a later run.
- [x] 9.3 Add the script to `package.json` as `enrich:chatters`.

## 10. Backfill and verification

- [x] 10.1 Run `scripts/recompute-memberships.ts --apply` against production so
  every existing membership gains its earning line and cached balance, and record
  the before/after counts.
- [x] 10.2 Create `scripts/verify-credit-ledger.ts` asserting, against
  production: every membership's `credits` equals the sum of its ledger lines;
  every membership holds at most one `earned` line; every `earned` line equals
  `credits_for_xp` of that membership's `lifetime_xp`; no ledger line is orphaned.
  Add it to `package.json` as `verify:credit-ledger`.
- [x] 10.3 `scripts/verify-credit-merge.ts` seeds real channels and memberships
  inside a transaction and rolls back, covering nine cases against production:
  the earning line derives from XP on insert and on change, an overdraft is
  refused and writes nothing, a spend within balance updates the cache, a
  re-score rewrites earnings and leaves the spend, an earning line is rewritten
  rather than duplicated, `earned` is refused as a spend kind, deleting a
  membership cascades its lines, and a merge carries spends to the survivor while
  re-deriving earnings from pooled XP. 9 of 9 pass. Added as
  `verify:credit-merge`.


- [x] 10.4 Add `tests/unit/credit-rate.test.ts` covering the earning rate as a
  pure function: 0 XP gives 0, 9 XP gives 0, 10 XP gives 1, 1640 XP gives 164,
  negative XP gives 0.
- [x] 10.5 Run `npx tsc --noEmit`, `npm run lint`, and `npx vitest run`, and
  confirm all pass.

## 11. Live confirmation

- [x] 11.1 `npm run verify:credit-ledger` after the backfill: 148 memberships,
  148 earning lines, 2241 credits earned, 0 spent, 8 members holding a balance,
  every cached balance matching its ledger.


- [x] 11.2 On-stream confirmation raised as AZ-219, covering first-time chatter
  onboarding, standing moving mid-broadcast, earning then spending in one
  broadcast, the enrichment switch changing which creation path runs, and the
  host and bot staying excluded. Not left as a task here.
