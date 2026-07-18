## ADDED Requirements

### Requirement: Deterministic command detection

The system SHALL treat a chat message as a command exactly when its trimmed body
starts with `!` immediately followed by an alphanumeric/underscore keyword,
matching case-insensitively, with everything after the keyword as the argument
string. Detection SHALL be deterministic (no AI) and shared between the worker
and any UI via one parser. Command messages SHALL remain visible in chat like any
other message and SHALL NOT be sent to the AI scoring batch.

#### Scenario: Command parsed

- **WHEN** a viewer posts `!help` or `!TTS hello there` in either chat origin
- **THEN** the parser yields the lowercased keyword (`help`, `tts`) and the
  argument string (``, `hello there`), and the message is excluded from scoring
  while remaining visible in chat

#### Scenario: Non-commands pass through

- **WHEN** a message is `hello!`, `!`, or `!!fun`
- **THEN** it is not treated as a command and flows to scoring as normal chat

### Requirement: Command registry with tunable limits

The system SHALL store commands in a per-channel registry (`chat_commands`) where
each row carries the keyword, kind (`builtin`/`custom`), a description, a
per-user cooldown in seconds, an optional per-user per-stream total limit, and an
enabled flag — all editable as data, never hard-coded constants. The registry
SHALL be publicly readable for enabled rows (for the guide page) and writable
only by the service role. The worker SHALL pick up registry changes without a
restart (short cache TTL).

#### Scenario: Limits are data

- **WHEN** the owner changes a command's `cooldown_s` or `max_per_stream` in the
  registry
- **THEN** the worker enforces the new values on its next registry refresh with
  no code change or restart

#### Scenario: Disabled command

- **WHEN** a viewer invokes a command whose registry row is disabled
- **THEN** the command does not execute and the attempt is logged with status
  `disabled`

### Requirement: Per-user cooldowns and per-stream totals

The system SHALL enforce, per participant (vids.tube user id or YouTube channel
id) and per command: a cooldown of `cooldown_s` seconds between executions, and —
when `max_per_stream` is set — a maximum number of executions per stream.
Enforcement SHALL be accounted from the command event log. Banned participants'
commands SHALL be ignored entirely.

#### Scenario: Cooldown enforced

- **WHEN** a viewer executes a command and repeats it within its cooldown
- **THEN** the second attempt does not execute and is logged with status
  `cooldown`

#### Scenario: Per-stream total enforced

- **WHEN** a viewer has already executed a command `max_per_stream` times in the
  current stream
- **THEN** further attempts do not execute and are logged with status `limit`

#### Scenario: Banned participant ignored

- **WHEN** a banned participant posts a command
- **THEN** no command executes and no event is logged for it

### Requirement: Command event log

The system SHALL record every detected command attempt as a `command_events` row
with the stream, participant, origin, keyword, arguments, outcome status
(`executed`/`cooldown`/`limit`/`disabled`/`unknown`), and the reply text the
handler produced (when any). The log SHALL be readable only by the channel owner
and SHALL be the source of truth for cooldown/limit accounting and verification.

#### Scenario: Executed command logged

- **WHEN** a command passes all checks and its handler runs
- **THEN** an `executed` event row exists with its keyword, args, participant,
  and the handler's reply text

### Requirement: !help and unknown commands

The system SHALL provide a built-in `!help` command whose reply lists the
channel's enabled commands and links to the public guide page. An unknown
`!keyword` SHALL receive a single pointer-to-`!help` reply per participant per
stream (logged with status `unknown`); repeats from the same participant in the
same stream SHALL be silently ignored.

#### Scenario: Help reply

- **WHEN** a viewer sends `!help`
- **THEN** the recorded reply lists the enabled commands and includes the
  `/{channelSlug}/commands` guide URL

#### Scenario: Unknown command pointed to help once

- **WHEN** a viewer sends `!doesnotexist` twice in one stream
- **THEN** the first attempt logs an `unknown` event with a reply pointing to
  `!help`, and the second logs nothing

### Requirement: Public command guide page

The system SHALL serve a public page at `/{channelSlug}/commands` listing the
channel's enabled commands — keyword, description, cooldown, and per-stream limit
when set — with an empty state when none are enabled, and a not-found state for
an unknown channel slug.

#### Scenario: Guide lists commands

- **WHEN** a visitor opens `/{channelSlug}/commands` for a channel with enabled
  commands
- **THEN** each enabled command renders with its `!keyword`, description, and
  limits, without requiring sign-in

#### Scenario: Unknown channel

- **WHEN** a visitor opens `/commands` under a slug that matches no channel
- **THEN** the page shows a not-found state
