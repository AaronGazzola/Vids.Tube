# chat-history-index Specification

## Purpose

Archive the channel's full YouTube chat history (public and owner-pasted
unlisted VODs) as raw per-message rows plus per-chatter aggregates keyed by
the YouTube author channel id, so identity features like !me can match live
chatters to their history without sign-in.
## Requirements
### Requirement: Raw YouTube chat archive

The system SHALL store the channel's YouTube chat history as raw per-message
rows (`youtube_chat_archive`): video id, replay item id (deduplicated per
video), author channel id, author display name, message text, and published
time — so any future metric (per-stream counts, streaks, most-active stream)
can be derived without re-downloading. Processed videos SHALL be tracked in
`youtube_vods` with their title and message count. Both tables SHALL be readable
only by the owner and written only by the service role.

#### Scenario: Messages archived losslessly

- **WHEN** the backfill processes a VOD with chat replay
- **THEN** each replayed message exists as an archive row with its author
  channel id, name, text, and timestamp, and the video's `youtube_vods` row
  records the count

#### Scenario: Replay-less video recorded

- **WHEN** a video has no chat replay
- **THEN** it still gets a `youtube_vods` row with zero messages so reruns skip
  it

### Requirement: Idempotent multi-source backfill

The system SHALL make every backfill and import step idempotent at the level of
the individual message rather than the containing stream or video. Importing
archived chat into `chat_messages` SHALL key on `external_message_id` so a
partially imported stream converges on re-run, and SHALL NOT skip a stream
merely because it already holds some YouTube-origin messages. Re-running any
import SHALL leave row counts unchanged once complete.

#### Scenario: Partial import self-heals

- **WHEN** a stream holds only some of its archived messages and the import is
  re-run
- **THEN** the missing messages are inserted and the existing ones are not
  duplicated

#### Scenario: Complete import is a no-op

- **WHEN** the import runs against a stream whose messages are already fully
  imported
- **THEN** no rows are inserted, updated, or deleted

#### Scenario: Archive and imported counts agree

- **WHEN** the import completes for a video
- **THEN** the count of `chat_messages` rows sourced from the archive for that
  video equals the count of `youtube_chat_archive` rows for it

### Requirement: Chatter aggregates

The system SHALL maintain `chatter_stats` — per YouTube author channel id: the
latest display name, total archived messages, number of videos attended, and
first/last seen timestamps — fully rebuilt from the archive at the end of each
backfill run. `chatter_stats` SHALL be a build artifact of the backfill only:
no runtime surface (commands, profiles, channel creation, membership recompute)
SHALL read it, and every runtime count SHALL derive from `chat_messages`
instead.

#### Scenario: Aggregates rebuilt

- **WHEN** the backfill completes
- **THEN** every archived author has a `chatter_stats` row whose totals equal
  the archive's per-author counts, with the most recent display name

#### Scenario: Runtime does not read the artifact

- **WHEN** a command, profile, membership recompute, or channel-creation job
  needs a chatter's message or attendance totals
- **THEN** it reads `chat_messages` and not `chatter_stats`

### Requirement: Archive is staging, not a read source

The system SHALL treat `youtube_chat_archive` as staging for the import into
`chat_messages`. Runtime surfaces SHALL NOT read it, including the `!me` sample
gathering that reads it today.

#### Scenario: Sample gathering reads one table

- **WHEN** message samples are gathered for an identity's profile
- **THEN** they come from `chat_messages` only

### Requirement: Archived videos without a stream are resolved explicitly

The system SHALL account for every archived video that has no corresponding
stream row, either by creating the stream row it belongs to or by recording an
explicit, logged skip reason. Such videos SHALL NOT be silently left
unimported.

#### Scenario: Unmapped archived video

- **WHEN** the import encounters archived messages for a video with no stream
- **THEN** it either creates the stream and imports, or logs the video id with a
  skip reason, and reports the totals either way

