## ADDED Requirements

### Requirement: Bridge vids.tube chat to YouTube

The system SHALL post each visible vids.tube chat message into the YouTube
live chat through Nightbot — as `name: message`, with the 400-char
word-boundary truncation — while the engaged stream is simulcast on YouTube
and the stream's bridge setting is enabled. Bridged sends SHALL share the Nightbot send queue
but yield to command replies, and SHALL wait in a bounded buffer of 5 that
drops the oldest bridged message (with a log line) when full. Command
messages, bot rows, and messages from banned participants SHALL NOT be
bridged. The bridge SHALL be controlled by `chat_scoring_state.bridge_enabled`
(default true), editable as a switch in the /live Settings tab.

#### Scenario: vids.tube message appears on YouTube

- **WHEN** a vids.tube viewer sends "hello" during a simulcast with the
  bridge enabled
- **THEN** Nightbot posts `<viewer name>: hello` to the YouTube live chat

#### Scenario: Replies outrank bridged chat

- **WHEN** a command reply and bridged messages are queued at the same time
- **THEN** the reply is sent on the next 5.2 s slot before any bridged
  message

#### Scenario: Overflow drops the oldest

- **WHEN** more than 5 bridged messages are waiting
- **THEN** the oldest is dropped and logged; the newest 5 remain queued

#### Scenario: Toggle off stops bridging

- **WHEN** the owner disables "Bridge chat to YouTube" and saves
- **THEN** subsequent vids.tube messages are not sent to YouTube, while
  command replies continue to deliver
