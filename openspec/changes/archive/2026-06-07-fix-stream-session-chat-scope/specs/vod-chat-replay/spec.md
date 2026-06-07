## ADDED Requirements

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
