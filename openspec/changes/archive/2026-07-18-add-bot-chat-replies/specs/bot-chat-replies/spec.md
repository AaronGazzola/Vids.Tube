## ADDED Requirements

### Requirement: Origin-local command replies

The system SHALL deliver each command reply to the chat origin the command came
from: a vids.tube command is answered by a VidsBot message in vids.tube chat; a
YouTube command is answered through Nightbot's send API into the YouTube live
chat. Replies SHALL NOT be cross-posted to the other origin, and the reply text
SHALL continue to be recorded on the command event.

#### Scenario: vids.tube command answered by VidsBot

- **WHEN** a viewer types an executable command in vids.tube chat
- **THEN** a `chat_messages` row with `origin='bot'` and author "VidsBot"
  containing the reply appears in that stream's chat, and no YouTube send occurs

#### Scenario: YouTube command answered via Nightbot

- **WHEN** a viewer types an executable command in the merged YouTube chat and a
  Nightbot token is configured
- **THEN** the reply is posted to Nightbot's `channel/send` endpoint and no
  vids.tube bot row is created

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
least 5.2 seconds apart (Nightbot's rate limit) and truncates messages to 400
characters on a word boundary. When `NIGHTBOT_CHANNEL_SEND_TOKEN` is not
configured the system SHALL skip YouTube sends with a clear log line and no
error; a failed send SHALL be logged with the response body and dropped after at
most one retry for rate-limit responses.

#### Scenario: Sends are spaced

- **WHEN** two YouTube replies are produced within a second of each other
- **THEN** the second Nightbot request starts no less than 5.2 seconds after the
  first

#### Scenario: Missing token skips gracefully

- **WHEN** no Nightbot token is configured and a YouTube reply is produced
- **THEN** nothing is sent, a skip is logged once, and command processing
  continues normally

### Requirement: Nightbot ingestion exclusion

The system SHALL drop YouTube chat messages authored by Nightbot — matched by
the configured Nightbot channel id, or by the exact display name "Nightbot" —
before persisting, scoring, or command-processing them, so the bot's own sends
never re-enter the pipeline.

#### Scenario: Nightbot's own message ignored

- **WHEN** the YouTube poller receives a message authored by Nightbot
- **THEN** it is not inserted into `chat_messages`, not scored, and not treated
  as a command
