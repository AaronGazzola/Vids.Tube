## ADDED Requirements

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
