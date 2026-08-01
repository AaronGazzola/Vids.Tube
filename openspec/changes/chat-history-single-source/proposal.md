# `chat_messages` is the single source of chat history

## Why

The same message currently lives in two tables with two different counting
paths, and the reconciliation between them is a timestamp watermark that only
protects one of them.

- `scripts/backfill-youtube-chat.ts` writes `youtube_chat_archive` (4986 rows,
  136 videos) and aggregates it into `chatter_stats` (145 rows).
- `scripts/import-youtube-vods.ts` `importChat` copies those same archive rows
  into `chat_messages` with `user_id: null` and `created_at` set to the original
  `published_at`.
- The worker writes live YouTube chat into the same `chat_messages` table.

`gatherMeStats` in `worker/lib/me-command.ts:85` then adds `chatter_stats` plus
`chat_messages` newer than `chatter_stats.last_seen_at`, and separately adds
every `chat_messages` row matching `user_id` with no date filter at all. Before
linking there is no overlap, because imported rows carry a null `user_id`. After
`merge_youtube_identity` re-keys those rows to the user, the account branch
counts messages the archive branch already counted. Claiming an identity
therefore inflates its own totals, which is the exact opposite of what the claim
flow promises.

The import is also incomplete, so the archive and `chat_messages` disagree
before any linking happens: 4986 archive rows against 4779 YouTube-origin
`chat_messages`. 13 archive videos map to no stream row (132 rows), and 4 further
streams disagree with their archive. `importChat` skips a stream that already
holds any YouTube chat, so a partially imported stream stays partial forever.
11 unclaimed channels have zero `chat_messages` and consequently render a
profile of zeros.

## What Changes

- **`chat_messages` becomes the single source of truth** for message history,
  for every origin, before and after linking.
- **`youtube_chat_archive` is demoted to import staging.** No runtime surface
  reads it.
- **`chatter_stats` becomes a build artifact of the backfill**, not an input to
  `!me`, profiles, or the unclaimed-channel job.
- **Import becomes idempotent per message**, keyed on `external_message_id`,
  so a partial import self-heals on re-run instead of being skipped forever.
- **The import gap is closed**: the 13 unmapped videos are either given stream
  rows or skipped with a logged reason, and archive-versus-imported counts are
  asserted per video.
- **`gatherMeStats` collapses to one query** over `chat_messages` filtered by
  `user_id` or `external_author_id`, deleting both the `chatter_stats` read and
  the `last_seen_at` watermark, which removes the double count structurally
  rather than by adding another filter.
- **`recompute_membership` covers archive-only identities**, closing the 11
  zero-stat profiles.
- **The creation job reads `chat_messages`** rather than `chatter_stats`.
- **Totals are invariant across linking.** A chatter's message and stream counts
  are identical immediately before and immediately after they claim, which
  becomes an asserted test rather than an assumption.

## Capabilities

### Modified Capabilities

- `chat-history-index`: the archive is staging, `chatter_stats` is a build
  artifact, and the backfill is idempotent per message rather than per stream.
- `me-command`: live-accruing stats come from one source with no watermark.
- `memberships`: every identity with any `chat_messages` row gets a membership,
  so archive-only chatters are no longer invisible.

## Impact

- **Depends on** `host-participant-class` for the job's skip set, since this
  change repoints that job's input.
- **Scripts**: `scripts/import-youtube-vods.ts`, `scripts/backfill-youtube-chat.ts`,
  `scripts/create-unclaimed-channels.ts`, plus a new
  `scripts/verify-chat-history.ts`.
- **Worker**: `worker/lib/me-command.ts` (`gatherMeStats`, sample gathering).
- **Migration**: a partial unique index supporting per-message import
  idempotency, and a `recompute_membership` update for archive-only identities.
- **Data**: about 207 archive rows are expected to be inserted into
  `chat_messages`, and up to 11 memberships created.
- **No UI work.** The profile zero-state is fixed by the data, not by rendering
  changes.
