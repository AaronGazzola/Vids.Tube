## MODIFIED Requirements

### Requirement: Time-synced chat replay

The system SHALL display the originating live stream's chat messages alongside a
VOD, advancing them in sync with the video timeline. Each message's reveal time
SHALL be its **video-time offset**, computed from the stream's `live_at` (the VOD
start) and the stream's reconnect gaps (`stream_gaps`): the offset is
`(created_at − live_at)` minus the total duration of gaps that ended at or before
the message, and a message sent **during** a gap SHALL be clamped to that gap's cut
point so that all messages in a gap reveal together the instant the video jumps.
When `live_at` is absent (legacy VOD), the offset SHALL fall back to
`created_at − started_at` with no gap adjustment. The set of revealed messages SHALL
correspond to the player's current playback time. Each revealed message's author
SHALL be presented as the author's channel identity — the channel `@handle` and
avatar resolved from the channel whose `owner_user_id` equals the message's author
`user_id` — and SHALL link to that author's channel page. The author's channel
display name SHALL NOT be shown in the replay. The system SHALL NOT render a raw or
truncated user id as the author.

#### Scenario: Messages reveal in time

- **WHEN** a viewer plays a VOD whose `source_stream_id` has chat messages
- **THEN** only messages whose video-time offset is at or before the current
  playback time are shown, and later messages appear as playback reaches their
  offset, each labelled with its author's channel handle and avatar

#### Scenario: Seeking re-aligns the replay

- **WHEN** a viewer seeks the VOD to a new position
- **THEN** the replay panel shows exactly the messages whose video-time offset is at
  or before that position, dropping any later messages

#### Scenario: Messages before the live start

- **WHEN** a chat message's `created_at` precedes the stream's `live_at`
  (offset is negative)
- **THEN** the message is treated as offset 0 and is visible from the start of
  playback

#### Scenario: Reconnect gap stays in sync

- **WHEN** a broadcast had an encoder disconnect (a `stream_gaps` gap) and the VOD
  jump-cuts over it, and messages were posted during that gap
- **THEN** those messages reveal together exactly when playback reaches the cut, and
  every message after the gap reveals shifted earlier by the gap's duration so it
  stays aligned with the video

#### Scenario: Author has no resolvable channel

- **WHEN** a replayed message's author `user_id` has no matching channel row
- **THEN** the message renders with a neutral placeholder identity (no raw user
  id, no error)

### Requirement: VOD chat replay is scoped to its own session

The system SHALL ensure a VOD's chat replay contains only the chat messages of
the broadcast session that produced it. Because each broadcast session is its own
`streams` row, a VOD's `source_stream_id` SHALL reference exactly one session, and
its replay SHALL anchor message offsets to that session's `live_at` (falling back to
`started_at` for legacy sessions) and that session's reconnect gaps. A VOD SHALL NOT
show chat messages from any other session of the same channel.

#### Scenario: Replay shows only this session's chat

- **WHEN** a channel broadcasts two separate sessions, each producing its own VOD
- **THEN** each VOD's chat replay shows only the messages posted during its own
  session, and neither VOD shows the other session's messages

#### Scenario: Offsets anchor to this session's live start

- **WHEN** a viewer plays a VOD whose source session has messages spread across
  the broadcast duration
- **THEN** each message is revealed at the playback position equal to its video-time
  offset from that session's `live_at`, adjusted for reconnect gaps, revealing
  progressively rather than all at playback start
