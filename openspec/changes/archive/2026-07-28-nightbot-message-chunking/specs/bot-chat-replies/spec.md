# bot-chat-replies Specification (delta)

## MODIFIED Requirements

### Requirement: Nightbot send queue

The system SHALL send YouTube replies through a queue that spaces requests at
least 5.2 seconds apart (Nightbot's rate limit). A reply that exceeds Nightbot's
400-character per-message limit SHALL be split into multiple ≤400-character
messages on whitespace boundaries rather than truncated: each part SHALL carry a
` (n/m)` continuation marker when the reply spans more than one part, the split
SHALL be capped at 3 parts (the last part ellipsis-truncated if content remains),
and each part SHALL be enqueued as its own send so parts inherit the queue's
spacing and its precedence behind command replies. A reply of 400 characters or
fewer SHALL be sent as a single message with no marker. When
`NIGHTBOT_CHANNEL_SEND_TOKEN` is not configured the system SHALL skip YouTube
sends with a clear log line and no error; a failed send SHALL be logged with the
response body and dropped after at most one retry for rate-limit responses.

#### Scenario: Sends are spaced

- **WHEN** two YouTube replies are produced within a second of each other
- **THEN** the second Nightbot request starts no less than 5.2 seconds after the
  first

#### Scenario: Short reply sent as one message

- **WHEN** a reply of 400 characters or fewer is produced
- **THEN** it is sent as a single Nightbot message with no continuation marker

#### Scenario: Long reply is split, not truncated

- **WHEN** a reply longer than 400 characters is produced
- **THEN** it is delivered as multiple Nightbot messages, each 400 characters or
  fewer, split on whitespace, each tagged with a `(n/m)` marker, and no content is
  lost within the 3-part cap

#### Scenario: Split respects the part cap

- **WHEN** a reply is long enough to need more than 3 parts
- **THEN** exactly 3 messages are sent and the third ends with an ellipsis

#### Scenario: Missing token skips gracefully

- **WHEN** no Nightbot token is configured and a YouTube reply is produced
- **THEN** nothing is sent, a skip is logged once, and command processing
  continues normally

### Requirement: Bridge vids.tube chat to YouTube

The system SHALL post each visible vids.tube chat message into the YouTube
live chat through Nightbot — as `name: message`, as a single message with the
400-char word-boundary truncation (bridged messages are not split into multiple
parts) — while the engaged stream is simulcast on YouTube and the stream's bridge
setting is enabled. Bridged sends SHALL share the Nightbot send queue but yield to
command replies, and SHALL wait in a bounded buffer of 5 that drops the oldest
bridged message (with a log line) when full. Command messages, bot rows, and
messages from banned participants SHALL NOT be bridged. The bridge SHALL be
controlled by `chat_scoring_state.bridge_enabled` (default true), editable as a
switch in the /live Settings tab.

#### Scenario: vids.tube message appears on YouTube

- **WHEN** a vids.tube viewer sends "hello" during a simulcast with the
  bridge enabled
- **THEN** Nightbot posts `<viewer name>: hello` to the YouTube live chat

#### Scenario: Long bridged message is truncated, not split

- **WHEN** a bridged vids.tube message exceeds 400 characters
- **THEN** it is sent as a single truncated Nightbot message, not multiple parts

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
