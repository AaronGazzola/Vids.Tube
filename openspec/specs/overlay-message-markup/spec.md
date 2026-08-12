# overlay-message-markup Specification

## Purpose
TBD - created by archiving change add-cycling-member-messages. Update Purpose after archive.
## Requirements
### Requirement: Overlay messages carry four kinds of formatting

A message SHALL support bold, italic, underline and a text colour, written as markup
within the message text: `**bold**`, `*italic*`, `__underline__`, and `{#rrggbb|coloured
text}`. Formatting SHALL be combinable, so a run of text may carry more than one kind at
once.

#### Scenario: Each mark renders

- **WHEN** a message containing each of the four marks is rendered
- **THEN** the corresponding runs are drawn bold, italic, underlined, and in the given
  colour

#### Scenario: Marks combine on one run

- **WHEN** a message nests one mark inside another
- **THEN** the affected run carries both kinds of formatting

#### Scenario: Unformatted text is unaffected

- **WHEN** a message contains no markup
- **THEN** it renders as plain text with the strip's own styling

### Requirement: Malformed markup renders literally

Parsing a message SHALL NOT throw and SHALL NOT discard text. Markup that is unclosed,
unrecognised, or otherwise malformed SHALL be rendered as the literal characters that were
typed, so a streamer sees their mistake rather than losing their words.

#### Scenario: An unclosed mark is shown as typed

- **WHEN** a message contains an opening `**` with no closing pair
- **THEN** the characters are drawn literally and the rest of the message still renders

#### Scenario: An unrecognised colour is shown as typed

- **WHEN** a colour token holds something that is not a six-digit hex colour
- **THEN** the token is drawn literally and no colour is applied

#### Scenario: No message can produce markup or raw markup handling

- **WHEN** any message, including one containing angle brackets or markup-like text, is
  rendered
- **THEN** the result is drawn as text runs and no part of the message is interpreted as
  markup by the browser

### Requirement: The message editor writes the markup

The Settings tab of `/live` SHALL provide, for each message, a text field and controls for
bold, italic, underline and colour. Activating a control SHALL wrap the current selection
in the corresponding markup, or insert an empty pair at the cursor when no text is
selected. The colour control SHALL write the chosen colour into the token.

#### Scenario: A control wraps the selection

- **WHEN** the streamer selects part of a message and activates the bold control
- **THEN** the selected text is wrapped in the bold markup and the rest is unchanged

#### Scenario: A control with no selection inserts a pair

- **WHEN** the streamer activates a control with nothing selected
- **THEN** an empty markup pair is inserted at the cursor

#### Scenario: Colour is chosen, not typed

- **WHEN** the streamer picks a colour from the colour control
- **THEN** the chosen colour is written into the message's colour token

### Requirement: The editor shows the message as the overlay will draw it

The editor SHALL render each message as the overlay renders it, on the overlay's own
backing, so formatting and colour are judged before the message reaches a broadcast.

#### Scenario: The preview reflects an edit

- **WHEN** the streamer changes a message's text or formatting
- **THEN** the preview updates to show the rendered result

#### Scenario: The preview uses the overlay's backing

- **WHEN** a message preview is shown
- **THEN** it is drawn on the same backing the strip uses, so a colour that would be
  unreadable on air is unreadable in the preview

### Requirement: A message's visible length is capped

The system SHALL cap the visible length of a message, counted after markup is removed so
that formatting does not consume the budget, and SHALL show the streamer the remaining
length as the message is written. A message over the cap SHALL NOT be saved.

#### Scenario: Formatting does not count toward the cap

- **WHEN** a message's visible text is within the cap but its markup makes the stored text
  longer
- **THEN** the message is accepted

#### Scenario: An over-long message is refused

- **WHEN** a message's visible text exceeds the cap
- **THEN** saving is refused and the streamer is told, rather than the strip being allowed
  to overflow on air

