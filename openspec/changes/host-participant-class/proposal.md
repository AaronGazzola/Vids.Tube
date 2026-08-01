# Host is a participant class, not a member of their own community

## Why

`scripts/create-unclaimed-channels.ts` treated the streamer's own YouTube id as
just another chatter, because it appears in `chatter_stats` like everyone else.
That created a second identity, `@azanything_2`, holding
`youtube_channel_id = UCENGTQuiakX7P7KwfakPlgg` with no owner, and
`recompute_membership` gave it a membership in the owner's own community
(179 messages). When the owner then verified their link on 28-Jul-2026, the merge
tried to carry that membership onto the survivor, producing
`channel_id = community_channel_id`, violating the `memberships` check
constraint and rolling the whole merge back.

`20260728151339_fix_self_community_merge.sql` added SQL guards four minutes
later, but the guards are a backstop, not the fix: the duplicate identity is
still created by the job, and no merge has ever completed. Live state today is
`channels.youtube_channel_id` null on the owner community, `@azanything_2` still
public and claimable, 193 `chat_messages` still keyed to the YouTube id, and
0 tombstones.

The host is a distinct participant class. They are not a member of their own
community (no XP, no level, no streak, no rank), they are not a bot (they must
keep full command execution), and they need no auto-created chatter channel
because they already are the community channel.

## What Changes

- **Host detection is automatic and per community.** A YouTube message whose
  author channel id equals the stream's `youtube_channel_id` is a host message.
  That column is already populated from `videos.list` `snippet.channelId` in
  `app/(app)/live/broadcast.actions.ts:772`, so no OAuth and no configuration
  are added.
- **Host messages are attributed at ingest.** The worker inserts them with
  `user_id` set to the community channel's `owner_user_id`, so the host badge,
  `!me`, and moderation all resolve without a second lookup.
- **Host messages are never scored.** They skip the scoring buffer entirely, so
  they can never produce `viewer_scores`, XP, or a leaderboard position.
- **Host messages still run commands, with elevated rights.** Unlike bot
  messages, host messages continue through command dispatch.
- **No chatter channel is created for a host.** The creation job skips any
  author channel id held by a community channel or by any owned channel.
- **`!me` from the host returns a community-scoped reply** (members, messages
  tonight, streams to date) and never the claim prompt.
- **Auto-detection never verifies a link.** `youtube_links.verified_at` is still
  only written by the chat-code path, because pasting a YouTube URL proves
  nothing about controlling that YouTube account. Auto-detection is scoped to
  suppression inside that streamer's own community.
- **The existing broken data is repaired** as part of this change: the merge is
  re-run against the fixed functions, `@azanything_2` is tombstoned, and the
  host's 2 `viewer_scores` rows are removed.

## Capabilities

### New Capabilities

- `host-participation`: host detection from the stream's YouTube channel id,
  ingest attribution, scoring exclusion, command retention, chatter-channel
  suppression, and the per-community scope rule.

### Modified Capabilities

- `memberships`: the host-exclusion invariant is stated as a requirement rather
  than resting only on the check constraint.
- `me-command`: a host branch that answers with community-scoped numbers and
  never appends the claim prompt.
- `identity-merge`: a self-membership is skipped rather than carried, and
  verification remains code-only even when the host's YouTube id is already
  known.

## Impact

- **Depends on** the `unclaimed-channels` and `public-channels-and-claim-hint`
  changes being archived, since it modifies the job and the `!me` claim prompt
  they introduced.
- **Worker**: `worker/jobs/score.ts` (`consumeYoutube`), `worker/lib/me-command.ts`.
- **Scripts**: `scripts/create-unclaimed-channels.ts`, plus a new
  `scripts/repair-host-identity.ts` and `scripts/verify-host-class.ts`.
- **Migration**: a trigger preventing an ownerless channel from being created for
  a YouTube id already held by a community channel.
- **No UI work.** The host badge is a rendering concern and is deliberately out
  of scope here; the ingest attribution this change makes is what a later badge
  would read.
- **Data repair** touches production rows: one merge run, one tombstone, two
  `viewer_scores` deletions.
