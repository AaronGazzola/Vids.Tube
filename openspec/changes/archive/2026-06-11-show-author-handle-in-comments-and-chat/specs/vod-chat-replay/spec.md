## MODIFIED Requirements

### Requirement: Time-synced chat replay

The system SHALL display the originating live stream's chat messages alongside a
VOD, advancing them in sync with the video timeline. Each message's reveal time
SHALL be its offset from the stream's `started_at`
(`chat_messages.created_at - streams.started_at`), and the set of revealed
messages SHALL correspond to the player's current playback time. Each revealed
message's author SHALL be presented as the author's channel identity — the
channel `@handle` and avatar resolved from the channel whose `owner_user_id`
equals the message's author `user_id` — and SHALL link to that author's channel
page. The author's channel display name SHALL NOT be shown in the replay. The
system SHALL NOT render a raw or truncated user id as the author.

#### Scenario: Messages reveal in time

- **WHEN** a viewer plays a VOD whose `source_stream_id` has chat messages
- **THEN** only messages whose offset is at or before the current playback time
  are shown, and later messages appear as playback reaches their offset, each
  labelled with its author's channel handle and avatar

#### Scenario: Seeking re-aligns the replay

- **WHEN** a viewer seeks the VOD to a new position
- **THEN** the replay panel shows exactly the messages whose offset is at or
  before that position, dropping any later messages

#### Scenario: Messages before stream start

- **WHEN** a chat message's `created_at` precedes the stream's `started_at`
  (offset is negative)
- **THEN** the message is treated as offset 0 and is visible from the start of
  playback

#### Scenario: Author has no resolvable channel

- **WHEN** a replayed message's author `user_id` has no matching channel row
- **THEN** the message renders with a neutral placeholder identity (no raw user
  id, no error)
