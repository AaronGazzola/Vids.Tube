# bot-chat-replies Specification

## Purpose

Deliver command replies to the origin they came from — VidsBot rows in
vids.tube chat and rate-limited Nightbot sends in the merged YouTube chat —
with a distinct bot identity that is visible in chat but never re-enters
scoring, moderation, or command processing.
## Requirements
### Requirement: Origin-local command replies

The system SHALL deliver each command reply to the chat origin the command came
from: a vids.tube command is answered by a VidsBot message in vids.tube chat; a
YouTube command is answered through Nightbot's send API into the YouTube live
chat. A YouTube reply SHALL also be recorded as a VidsBot row in vids.tube chat
so the owner sees everything the bot says, and the reply text SHALL continue to
be recorded on the command event.

#### Scenario: vids.tube command answered by VidsBot

- **WHEN** a viewer types an executable command in vids.tube chat
- **THEN** a `chat_messages` row with `origin='bot'` and author "VidsBot"
  containing the reply appears in that stream's chat, and no YouTube send occurs

#### Scenario: YouTube command answered via Nightbot

- **WHEN** a viewer types an executable command in the merged YouTube chat and a
  Nightbot token is configured
- **THEN** the reply is posted to Nightbot's `channel/send` endpoint and a
  single `origin='bot'` VidsBot row is recorded in vids.tube chat

### Requirement: VidsBot identity rendering

The system SHALL render `origin='bot'` chat rows as **VidsBot** — a distinct bot
avatar, the name "VidsBot", and a bot badge — in both the public live chat and
the owner Activity chat. Bot rows SHALL NOT show a score badge or the moderation
three-dot menu, SHALL never be scored or counted in viewer stats, and SHALL NOT
be processed by the command pipeline.

#### Scenario: Bot row renders distinctly

- **WHEN** a VidsBot reply appears in chat
- **THEN** it renders with the bot avatar, "VidsBot", and a bot badge, with no
  score badge and no moderation menu

#### Scenario: Bot rows earn nothing

- **WHEN** the worker's next scoring pass runs after a VidsBot reply
- **THEN** the bot row is not scored, not command-processed, and appears in no
  leaderboard or stats

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

### Requirement: Nightbot token self-renewal

The system SHALL treat the Nightbot access token as renewable state rather
than a static secret. The worker SHALL refresh the token via Nightbot's
`oauth2/token` refresh grant — using the stored refresh token and client
credentials — whenever the recorded expiry is unknown or less than 5 days
away, and immediately when a send returns HTTP 401 (retrying that send once
with the new token). Each successful refresh SHALL replace the access token,
refresh token, and expiry both in the running process and in Doppler. A failed
refresh SHALL be logged with at most one attempt per hour and SHALL NOT
affect vids.tube VidsBot replies; YouTube sends then fall back to the existing
skip behavior.

#### Scenario: Renew-ahead at startup

- **WHEN** the worker starts and `NIGHTBOT_TOKEN_EXPIRES_AT` is less than 5
  days away
- **THEN** the worker exchanges the refresh token for a new pair, uses it for
  subsequent sends, and persists the new token, refresh token, and expiry to
  Doppler

#### Scenario: Expired token during a send

- **WHEN** a Nightbot send returns HTTP 401
- **THEN** the worker refreshes once and retries that send once with the new
  token; a second failure is logged and the message dropped

#### Scenario: Refresh failure is non-fatal

- **WHEN** the refresh grant fails (revoked refresh token, network error)
- **THEN** the failure is logged (no more than once per hour), YouTube sends
  skip as if unconfigured, and vids.tube replies continue unaffected

### Requirement: Nightbot visible but never scored

The system SHALL identify YouTube chat messages authored by Nightbot — matched
by the configured Nightbot channel id, or by the exact display name "Nightbot" —
and persist them as `origin='bot'` `chat_messages` rows so they appear in
vids.tube chat, while excluding them from scoring, moderation, command
processing, viewer stats, and the YouTube bridge. Text the system itself pushed
through Nightbot (command replies, broadcasts, bridged vids.tube messages) comes
back through the poller as a Nightbot message and is already recorded, so each
such echo SHALL be matched against recently sent text and dropped rather than
persisted a second time.

#### Scenario: Nightbot's own message appears in chat

- **WHEN** the YouTube poller receives a Nightbot message the system did not
  send (a Nightbot timer, or a reply to a native Nightbot command)
- **THEN** an `origin='bot'` row authored "Nightbot" appears in vids.tube chat,
  and it is not scored, not command-processed, and not bridged

#### Scenario: Our own send does not echo back

- **WHEN** the poller receives a Nightbot message whose text matches a reply,
  broadcast, or bridged message the system just sent
- **THEN** no additional `chat_messages` row is created

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

### Requirement: Replies are chunked to the platform's real limit

Outgoing replies SHALL be split to fit within YouTube live chat's 200-character limit, with any continuation marker counted inside that budget rather than appended beyond it, and SHALL break on a word boundary rather than mid-word.

#### Scenario: A long reply keeps its marker

- **WHEN** a reply longer than the limit is sent
- **THEN** each chunk is within the limit and carries its continuation marker

#### Scenario: A reply breaks on a word

- **WHEN** a reply is split
- **THEN** no chunk ends mid-word

#### Scenario: A short reply is sent whole

- **WHEN** a reply fits within the limit
- **THEN** it is sent as one message with no marker

### Requirement: The worker recognises its own reply however the transport rewrote it

An outgoing reply SHALL be remembered as a normalised prefix, with zero-width characters removed, whitespace collapsed and case folded. An incoming bot message SHALL be normalised the same way and treated as the worker's own when the prefixes match, whether or not the returned text was truncated or padded in transit.

#### Scenario: A truncated echo is recognised

- **WHEN** a reply comes back cut to the platform's limit
- **THEN** it is recognised as the worker's own

#### Scenario: A padded echo is recognised

- **WHEN** a reply comes back with zero-width characters prepended
- **THEN** it is recognised as the worker's own

#### Scenario: Another bot's message is not mistaken for the worker's

- **WHEN** a bot message arrives that the worker never sent
- **THEN** it is not recognised as an echo

#### Scenario: Recognition is consumed once

- **WHEN** the same reply is sent once and comes back twice
- **THEN** the first is recognised and the second is not

### Requirement: A recognised echo is never stored

A message recognised as the worker's own reply SHALL NOT be written to chat history at all, because the reply was already stored when it was sent. No bot message SHALL be stored under a name other than the worker's own bot identity.

#### Scenario: A reply appears exactly once

- **WHEN** the worker sends a reply and the echo returns
- **THEN** chat history holds exactly one row for it, authored as the worker's bot

#### Scenario: A genuine bot message is still kept

- **WHEN** a bot message the worker did not send arrives
- **THEN** it is stored and remains visible in chat and in replay

