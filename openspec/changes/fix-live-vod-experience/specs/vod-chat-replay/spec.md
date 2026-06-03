## ADDED Requirements

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

The system SHALL show the chat replay panel by default when replay is available,
SHALL allow the viewer to dismiss it, and SHALL hide it entirely when no replay
is available.

#### Scenario: Shown by default

- **WHEN** a VOD has a `source_stream_id` whose stream has at least one chat
  message
- **THEN** the chat replay panel is visible alongside the player without any
  viewer action

#### Scenario: Viewer dismisses the panel

- **WHEN** the viewer dismisses the replay panel
- **THEN** the panel is hidden and the player remains fully usable

#### Scenario: No replay available

- **WHEN** a VOD has no `source_stream_id`, or its source stream has no chat
  messages
- **THEN** no chat replay panel is rendered and the watch page lays out as if
  replay did not exist

### Requirement: Replay is read-only

The system SHALL render the chat replay as read-only playback of historical
messages, with no composer and no posting affordance, since the stream has
ended.

#### Scenario: No composer in replay

- **WHEN** the chat replay panel is shown for a VOD
- **THEN** it contains no message input or send control
