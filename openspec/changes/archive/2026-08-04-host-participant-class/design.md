# Design: host participant class

## Participant classes

| Class | In chat | Scored | Membership | Own channel row | Commands | `!me` |
| --- | --- | --- | --- | --- | --- | --- |
| Vids.Tube viewer | Yes | Yes | Yes | Yes | Yes | Yes |
| YouTube viewer, unclaimed | Yes | Yes | Yes | Auto-created | Yes | Yes, with claim prompt |
| VidsBot | Yes | No | No | No | No | No |
| Host | Yes | No | No | No, is the community channel | Yes, elevated | Community-scoped reply |

The host row is the new one. The existing bot row is why "treat the host like
the bot" was rejected: `worker/jobs/score.ts:590` returns before command
dispatch for bot messages, which would kill `!ask`, `!clip`, `!break` and `!tts`
sent from the streamer's phone through YouTube chat.

## Detection

Two sources, used for different questions.

- `streams.youtube_channel_id` answers "whose broadcast is this chat attached
  to". Written in `app/(app)/live/broadcast.actions.ts:772` from
  `fetchVideoData(videoId).channelId`, which needs only `YOUTUBE_API_KEY`.
  Currently set on 5 streams, all `UCENGTQuiakX7P7KwfakPlgg`.
- `channels.youtube_channel_id` on the community channel answers the same
  question for historical streams, where `streams.youtube_channel_id` is null.
  Only 5 of 123 streams carry the column, so any backfill or repair path must
  use the channel-level value.

Detection is per stream, therefore per community. A channel that hosts one
community is still an ordinary scored member everywhere else, which is required
the first time a claimed chatter starts streaming.

## Why detection must not verify a link

Pasting a YouTube URL is not proof of controlling that YouTube channel. The
blast radius of the two mechanisms is deliberately different.

- Auto-detection can only suppress scoring and channel creation, and only inside
  the community whose stream carries the id. Worst case is one person's activity
  going unscored in one community.
- Code verification moves history between accounts permanently. Worst case is
  handing one person's chat history to another account.

So `youtube_links.verified_at` stays writable only by the chat-code path in
`worker/lib/verify-links.ts`.

## Ingest attribution

The alternative considered was leaving `user_id` null and comparing ids at read
time. Rejected: every rendering and aggregating surface would have to repeat the
join, and each one can forget it. Setting `user_id` at ingest makes the host a
normal attributed author everywhere downstream, which is also what
`merge_youtube_identity` does for a claimed chatter, so there is one attribution
model rather than two.

The known hazard is double counting in `gatherMeStats`, which today adds
`chatter_stats` (archive-derived) to `chat_messages` rows matched by `user_id`.
That defect is not fixed here; it is fixed by the `chat-history-single-source`
change, and the host `!me` branch added here reads a single source, so it does
not inherit the bug in the meantime.

## Enforcement layers

1. Ingest, `worker/jobs/score.ts` `consumeYoutube`: attribute and skip scoring.
2. Commands, `worker/lib/me-command.ts`: host branch, no claim prompt.
3. Job, `scripts/create-unclaimed-channels.ts`: skip host and owned ids.
4. Database: the `ee467ed` self-membership guards, plus a trigger blocking
   creation of an ownerless channel for a community's YouTube id.

Four layers is deliberate. Layers 1 to 3 are the behaviour; layer 4 exists so a
future script written by someone who has forgotten this rule fails loudly rather
than silently recreating `@azanything_2`.

## Repair of existing data

Ordered, because each step depends on the previous one.

1. Set `channels.youtube_channel_id` on the owner community, which is what makes
   historical host detection possible at all.
2. Re-run `merge_youtube_identity` for the owner, which tombstones
   `@azanything_2`, re-keys 193 `chat_messages`, and deletes the 179-message
   self-membership.
3. Delete the 2 host `viewer_scores` rows.
4. Re-run the creation job with the skip and assert the unclaimed count stays at
   145 and `@azanything_2` is not recreated.

The host's `chatter_stats` row (180 messages, 103 videos) is deliberately kept.
It is archive-derived data, and the job skip, not deletion, is what stops it
producing a channel.

## Out of scope

- The host badge in chat rendering.
- The community overview UX on the channel page.
- The `gatherMeStats` double count, owned by `chat-history-single-source`.
- Nightbot echo mislabelling, owned by its own Linear issue.
