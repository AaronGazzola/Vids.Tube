# vod-chat-replay Specification

## Purpose
TBD - created by archiving change fix-live-vod-experience. Update Purpose after archive.
## Requirements
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

### Requirement: Replay panel visibility

The system SHALL show the chat replay panel expanded by default when replay is
available, SHALL allow the viewer to collapse it to a compact re-expand control
and expand it again at will, SHALL give the video player the freed space while the
panel is collapsed, SHALL persist the collapsed/expanded preference across reloads
and navigations (defaulting to expanded), and SHALL render nothing when no replay
is available.

#### Scenario: Shown by default

- **WHEN** a VOD has a `source_stream_id` whose stream has at least one chat
  message
- **THEN** the chat replay panel is visible and expanded alongside the player
  without any viewer action

#### Scenario: Viewer collapses the panel

- **WHEN** the viewer collapses the replay panel
- **THEN** the message list is hidden, a compact re-expand control remains
  visible, and the video player expands to use the freed space

#### Scenario: Viewer re-expands the panel

- **WHEN** the viewer activates the re-expand control on a collapsed panel
- **THEN** the full replay panel is shown again, time-synced to the current
  playback position

#### Scenario: Collapsed preference persists

- **WHEN** the viewer collapses the panel and then reloads or navigates to
  another VOD that has replay
- **THEN** the panel starts collapsed, reflecting the saved preference

#### Scenario: No replay available

- **WHEN** a VOD has no `source_stream_id`, or its source stream has no chat
  messages
- **THEN** no chat replay panel or re-expand control is rendered and the watch
  page lays out as if replay did not exist

### Requirement: Replay is read-only

The system SHALL render the chat replay as read-only playback of historical
messages, with no composer and no posting affordance, since the stream has
ended.

#### Scenario: No composer in replay

- **WHEN** the chat replay panel is shown for a VOD
- **THEN** it contains no message input or send control

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

### Requirement: Horizontal-overflow-safe replay message rendering

The system SHALL render VOD chat-replay message bodies so that no message,
including one containing a single unbroken token longer than the replay panel's
width (such as a pasted URL), causes the replay panel to scroll horizontally. Long
words SHALL be broken so that all message content wraps within the panel's width.

#### Scenario: Long unbroken word wraps in replay

- **WHEN** a replayed message containing a single word longer than the replay
  panel's width is displayed
- **THEN** the word is broken across lines and the replay panel does not scroll
  horizontally

