# Tasks: host participant class

## 1. Repair the existing broken identity

- [x] 1.1 Create `scripts/repair-host-identity.ts` (service role, env/client pattern
  of `scripts/create-unclaimed-channels.ts`). It resolves the owner community as
  the earliest-created channel, reads that owner's verified `youtube_links` row,
  and aborts with a clear message if the link is unverified or absent.
- [x] 1.2 In that script, step one: set `channels.youtube_channel_id` on the owner
  community to the verified link's `youtube_channel_id`, skipping if already set.
- [x] 1.3 Step two: call `supabaseAdmin.rpc("merge_youtube_identity", { p_user_id })`
  and log the returned `{ merged, communities }` payload; abort the script if
  `merged` is false.
- [x] 1.4 Step three: delete `viewer_scores` rows whose `participant_key` is
  `youtube:<owner ycid>` or whose `external_author_id` is the owner's YouTube id,
  logging the deleted count (currently 2).
- [x] 1.5 Step four: assert and log the post-conditions: the community channel has
  a non-null `youtube_channel_id`, exactly one channel is tombstoned into it,
  0 `chat_messages` remain with `external_author_id` equal to the owner's
  YouTube id and a null `user_id`, and 0 memberships exist whose `channel_id`
  equals their `community_channel_id`.
- [x] 1.6 Run the script once against production and record the before/after counts
  in the change's completion notes.

## 2. Detection and ingest

- [x] 2.1 Add `resolveHostChannelId(stream, channel)` to `worker/lib/streams.ts`
  returning `streams.youtube_channel_id` when set, otherwise the community
  channel's `channels.youtube_channel_id`, otherwise null.
- [x] 2.2 In `worker/jobs/score.ts` `consumeYoutube`, resolve the host id once
  before the poll loop and compare each message's `authorChannelId` against it to
  derive `isHost`.
- [x] 2.3 For a host message, insert into `chat_messages` with `user_id` set to the
  community channel's `owner_user_id`, keeping `origin: "youtube"` and
  `external_author_id`; leave `user_id` null when the channel has no owner.
- [x] 2.4 Skip `ytBuffer.push` for host messages so they never reach scoring, while
  leaving the existing bot `continue` at line 590 untouched.
- [x] 2.5 Confirm host messages still reach command dispatch by tracing the path a
  buffered-but-unscored message takes, and add a unit test in
  `tests/unit/host-class.test.ts` asserting a host message is not scored and is
  still command-dispatched.

## 3. Command layer

- [ ] 3.1 Extend `MeIdentity` in `worker/lib/me-command.ts` with an `isHost` flag
  and a `communityChannelId`, set by the same `resolveHostChannelId` comparison.
- [ ] 3.2 Add a `gatherHostStats(communityChannelId)` reading a single source:
  member count from `memberships`, messages in the current stream from
  `chat_messages`, and streams to date from `streams` with status `ended`.
- [ ] 3.3 Branch `meHandler` so a host identity renders the community-scoped reply
  and returns before the bio, XP, rank and streak paths.
- [ ] 3.4 Ensure `unclaimedClaimNudge` returns an empty string for a host identity,
  so the claim prompt added by `unclaimed-channels` task 4.1 can never target the
  host's own duplicate profile.
- [ ] 3.5 Add unit coverage in `tests/unit/me-command.test.ts` asserting the host
  reply contains no rank, level, streak or claim line.

## 4. Creation job

- [ ] 4.1 In `scripts/create-unclaimed-channels.ts`, load the set of YouTube ids to
  skip before the main loop: every `channels.youtube_channel_id` belonging to a
  channel with a non-null `owner_user_id`, plus every community channel's
  `youtube_channel_id`.
- [ ] 4.2 Skip any `chatter_stats.author_channel_id` in that set and log
  `skip <id> (host)` or `skip <id> (claimed)` per skip.
- [ ] 4.3 Re-run the job and assert the unclaimed channel count stays at 145 and no
  channel is recreated for the owner's YouTube id.

## 5. Database backstop

- [ ] 5.1 Create the migration via
  `npx supabase migration new block_duplicate_community_identity` adding a
  `before insert or update` trigger on `channels` that raises when
  `owner_user_id is null` and `youtube_channel_id` matches the
  `youtube_channel_id` of any channel that owns at least one row in `streams`.
- [ ] 5.2 Push with `npx supabase db push` and regenerate `supabase/types.ts`.
- [ ] 5.3 Add a script assertion in `scripts/verify-host-class.ts` that the trigger
  rejects such an insert and that the error message names the conflict.

## 6. Programmatic verification

- [ ] 6.1 Create `scripts/verify-host-class.ts` asserting, against production:
  0 memberships where `channel_id = community_channel_id`; 0 ownerless channels
  whose `youtube_channel_id` matches a community's; 0 `viewer_scores` rows for
  the owner's YouTube id; the owner community carries its `youtube_channel_id`.
- [ ] 6.2 Extend it with a simulated ingest assertion: given a synthetic host
  message and a synthetic viewer message on the same stream, the host row is
  attributed and unscored and the viewer row is scored.
- [ ] 6.3 Run `npx tsc --noEmit` and `npm run build:local`, and run the new unit
  tests.
