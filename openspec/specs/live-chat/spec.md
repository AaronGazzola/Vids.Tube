# live-chat Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Public chat read

The system SHALL allow anyone, including anonymous viewers, to read a live
stream's chat messages in real time.

#### Scenario: Anonymous viewer reads chat

- **WHEN** an anonymous viewer opens a live stream
- **THEN** they see existing chat messages and receive new messages in real time

### Requirement: Authenticated chat posting

The system SHALL allow only authenticated users to post chat messages, persisted
to `chat_messages` with the author's user id, and SHALL surface a sign-in prompt
to anonymous viewers in place of the composer.

#### Scenario: Authenticated user posts

- **WHEN** an authenticated user submits a chat message
- **THEN** the message is inserted with their user id and appears for all viewers
  in real time

#### Scenario: Anonymous user cannot post

- **WHEN** an anonymous viewer views the chat
- **THEN** the composer is replaced by a sign-in prompt and no message can be sent

#### Scenario: Insert integrity enforced by RLS

- **WHEN** any client attempts to insert a chat message with a user id other than
  its own
- **THEN** row-level security rejects the insert

### Requirement: Per-session chat scoping

The system SHALL scope live chat to a single broadcast session. Because each
broadcast is its own `streams` row and `chat_messages` reference a `stream_id`, a
newly started broadcast SHALL begin with an empty chat and SHALL never display
messages posted during a previous session of the same channel.

#### Scenario: New broadcast starts with empty chat

- **WHEN** a channel's previous broadcast ended with chat messages, and the
  channel goes live again as a new session
- **THEN** the live chat for the new session shows no messages from the previous
  session, starting empty until new messages are posted

#### Scenario: Messages are read for the current session only

- **WHEN** a viewer opens a channel that is live
- **THEN** the chat read and the real-time subscription are filtered to the
  current session's `stream_id`, so only that session's messages are shown

