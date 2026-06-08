# vod-chat-replay Specification

## Purpose
TBD - created by archiving change fix-live-vod-experience. Update Purpose after archive.
## Requirements
### Requirement: Time-synced chat replay

The system SHALL display the originating live stream's chat messages alongside a
VOD, advancing them in sync with the video timeline. Each message's reveal time
SHALL be its offset from the stream's `started_at`
(`chat_messages.created_at - streams.started_at`), and the set of revealed
messages SHALL correspond to the player's current playback time.

#### Scenario: Messages reveal in time

- **WHEN** a viewer plays a VOD whose `source_stream_id` has chat messages
- **THEN** only messages whose offset is at or before the current playback time
  are shown, and later messages appear as playback reaches their offset

#### Scenario: Seeking re-aligns the replay

- **WHEN** a viewer seeks the VOD to a new position
- **THEN** the replay panel shows exactly the messages whose offset is at or
  before that position, dropping any later messages

#### Scenario: Messages before stream start

- **WHEN** a chat message's `created_at` precedes the stream's `started_at`
  (offset is negative)
- **THEN** the message is treated as offset 0 and is visible from the start of
  playback

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
its replay SHALL anchor message offsets to that session's `started_at`. A VOD
SHALL NOT show chat messages from any other session of the same channel.

#### Scenario: Replay shows only this session's chat

- **WHEN** a channel broadcasts two separate sessions, each producing its own VOD
- **THEN** each VOD's chat replay shows only the messages posted during its own
  session, and neither VOD shows the other session's messages

#### Scenario: Offsets anchor to this session's start

- **WHEN** a viewer plays a VOD whose source session has messages spread across
  the broadcast duration
- **THEN** each message is revealed at the playback position equal to its offset
  from that session's `started_at`, revealing progressively rather than all at
  playback start

