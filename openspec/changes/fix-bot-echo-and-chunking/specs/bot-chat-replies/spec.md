## ADDED Requirements

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
