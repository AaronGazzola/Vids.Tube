## MODIFIED Requirements

### Requirement: Deterministic command detection

The system SHALL treat a chat message as a command exactly when its trimmed body
starts with `!` immediately followed by an alphanumeric/underscore keyword,
matching case-insensitively, with everything after the keyword as the argument
string. Detection SHALL be deterministic (no AI) and shared between the worker
and any UI via one parser. Command messages SHALL remain visible in chat like any
other message and SHALL be sent to the AI scoring batch alongside ordinary chat.

A command message SHALL be scored and eligible to be featured on the same terms as
any other message. Executing the command SHALL NOT depend on whether it scores, and
scoring SHALL NOT depend on whether the command executed, was refused for cooldown,
or was unknown.

#### Scenario: Command parsed

- **WHEN** a viewer posts `!help` or `!TTS hello there` in either chat origin
- **THEN** the parser yields the lowercased keyword (`help`, `tts`) and the
  argument string (``, `hello there`), and the message is scored like any other
  message while remaining visible in chat

#### Scenario: Non-commands pass through

- **WHEN** a message is `hello!`, `!`, or `!!fun`
- **THEN** it is not treated as a command and flows to scoring as normal chat

#### Scenario: A command message can be featured

- **GIVEN** a chatter posts a `!tts` message the AI judges the best of its batch
- **THEN** it is featured exactly as a non-command message would be, and the
  command still executes

#### Scenario: A refused command is still scored

- **GIVEN** a chatter posts a command that is on cooldown, disabled, or unknown
- **THEN** the message is still sent to the scoring batch, and the refusal is
  logged as it is today
