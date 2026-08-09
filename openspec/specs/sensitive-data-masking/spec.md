# sensitive-data-masking Specification

## Purpose
TBD - created by archiving change mask-sensitive-data. Update Purpose after archive.
## Requirements
### Requirement: Sensitive values are removed before a tool result reaches the session

A tool result SHALL be rewritten before the session receives it, so that a
sensitive value never enters the transcript. Rewriting MUST happen at the tool
boundary rather than after the session has read the value.

#### Scenario: A query result carrying an account address

- **WHEN** a database query returns a row containing `aaron@gazzola.dev`
- **THEN** the session receives `a****@g******.dev` in place of the address
- **AND** the unmasked address appears nowhere in the transcript

#### Scenario: Shell output carrying a token

- **WHEN** a shell command prints a JSON Web Token or a key with a recognisable
  prefix
- **THEN** the session receives the value masked

#### Scenario: A file read carrying a secret

- **WHEN** a file is read whose contents include a secret adjacent to a key-like
  name
- **THEN** the session receives the value masked

#### Scenario: Output with nothing sensitive in it

- **WHEN** a tool returns output containing no sensitive value
- **THEN** the output is passed through unchanged

### Requirement: Masked values stay distinguishable

Masking SHALL preserve enough shape that two different values produce two
different masks, so a result holding several accounts remains readable as
several accounts.

#### Scenario: Two different addresses in one result

- **WHEN** a result contains two different email addresses
- **THEN** the two masked forms differ from each other

#### Scenario: The same address twice in one result

- **WHEN** a result contains the same address twice
- **THEN** both occurrences produce the same masked form

### Requirement: Masking is announced, never silent

A rewritten result SHALL state that masking occurred, how many values were
masked, and which categories matched, so an empty result and a hidden result are
never confused.

#### Scenario: A result with values masked

- **WHEN** three addresses and one token are masked in one result
- **THEN** the rewritten output carries a notice naming four masked values and
  the two categories

#### Scenario: A result with nothing masked

- **WHEN** no value matched
- **THEN** no notice is added

### Requirement: Categories covered

The rule set SHALL cover email addresses, JSON Web Tokens, bearer tokens and API
keys carrying a recognisable prefix, secrets adjacent to a key-like name, phone
numbers, and postal addresses.

#### Scenario: Each category is matched

- **WHEN** a result contains one value of each covered category
- **THEN** every one of them is masked

#### Scenario: An ordinary identifier is left alone

- **WHEN** a result contains a record identifier
- **THEN** the identifier is passed through unmasked, because masking every
  identifier would make a result unreadable

### Requirement: A value can be revealed deliberately

Revealing a value SHALL require an explicit, single-command act that is visible
in the command itself. Masking MUST NOT be disableable for a whole session by a
setting that can be left switched on.

#### Scenario: Revealing for one command

- **WHEN** a command is run with the reveal switch set for that command alone
- **THEN** that command's output is returned unmasked

#### Scenario: The switch does not persist

- **WHEN** a later command runs without the reveal switch
- **THEN** that command's output is masked again

### Requirement: The safeguard is verifiable

A test SHALL feed the masking rules a payload containing a known value of every
covered category and assert the output is masked, so a broken safeguard fails a
test rather than failing silently during a broadcast.

#### Scenario: The safeguard is broken

- **WHEN** the masking rules stop matching a covered category
- **THEN** the test fails

### Requirement: What the session composes is covered by a written rule

The repository guidance SHALL forbid writing a sensitive value into a reply, a
commit message, a ticket or a file without asking first, covering the case where
the value originates in the session rather than in a tool result.

#### Scenario: A value learned earlier in the conversation

- **WHEN** a sensitive value would be written into a reply
- **THEN** confirmation is sought before the value is written

