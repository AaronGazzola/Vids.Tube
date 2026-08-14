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

The Settings tab of `/live` SHALL provide, for each message, an editable rich text field in
which text is typed and styled directly rather than by writing markup. The field SHALL offer
controls for bold, italic, underline and colour, each applying to the current selection, and
SHALL show the result as styled text as it is applied.

The markup SHALL remain the stored format. The field SHALL generate it from what is typed when
the message is saved, and SHALL parse an existing message into styled text when it is loaded
for editing. Colour SHALL be chosen from a fixed palette rather than typed, so a message cannot
carry a value that is unreadable on air.

Content pasted from elsewhere SHALL be reduced to the supported styles, and anything
unsupported SHALL be taken as plain text.

#### Scenario: Styling applies to the selection

- **WHEN** the streamer selects part of a message and activates the bold control
- **THEN** that text is shown bold in the field, and the rest is unchanged

#### Scenario: What is stored is markup

- **WHEN** the streamer styles a message and saves
- **THEN** the stored message is the markup form of what was typed

#### Scenario: An existing message opens as styled text

- **WHEN** the streamer opens a message that already carries bold, underline and colour
- **THEN** the field shows it styled rather than as markup

#### Scenario: Colour is chosen, not typed

- **WHEN** the streamer picks a colour from the colour control
- **THEN** the chosen colour is applied to the selection and written into the message's colour
  token

#### Scenario: Pasted content is reduced

- **WHEN** the streamer pastes content carrying styles the overlay cannot render
- **THEN** the supported styles are kept and the rest arrives as plain text

### Requirement: The editor shows the message as the overlay will draw it

The editable field SHALL render the message as styled text, so bold, italic, underline and
colour are seen as they are applied rather than as markup. Alongside it, the banner's own
rendering SHALL be shown on the banner's real backing at the banner's real proportions, with
the member count beside the message as the overlay draws it, so the line's width and
legibility are judged against the surface it lands on.

The banner is 810 pixels wide and the settings column is not, which is why the surface is
shown beside the field rather than being the field: making the field itself the banner would
either misrepresent its width or leave no room to type.

#### Scenario: The field reflects an edit

- **WHEN** the streamer changes a message's text or formatting
- **THEN** the field shows the styled result immediately, without markup characters

#### Scenario: The surface is the overlay's own

- **WHEN** a message is being edited
- **THEN** it is also drawn on the same backing the banner uses, so a colour that would be
  unreadable on air is unreadable here

#### Scenario: The count is shown but not editable

- **WHEN** the streamer edits the first message
- **THEN** the member count appears beside it in that rendering as the overlay draws it, and
  cannot be typed into

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

### Requirement: Markup and styled text round-trip without loss of meaning

Parsing a message into styled runs and serializing those runs back to markup SHALL produce a
message that renders identically to the original, for every form the parser supports, and SHALL
preserve every visible character. Serializing SHALL be stable, so repeated saves never drift.

Byte-identical output SHALL NOT be required, because the dialect does not record the order
nested marks were written in: a colour wrapping a bold run and a bold run wrapping a colour
parse to the same thing. Serializing SHALL therefore choose one canonical nesting, colour
outermost, so its output is deterministic. Markup already written canonically SHALL be
reproduced exactly.

#### Scenario: A formatted message survives editing

- **WHEN** a message carrying bold, italic, underline and colour is opened for editing and saved
  again with no change
- **THEN** the stored message renders exactly as it did, and every visible character is
  unchanged

#### Scenario: Saving repeatedly does not drift

- **WHEN** a message is opened and saved twice with no change
- **THEN** the second save produces exactly what the first did

#### Scenario: Malformed markup keeps its words

- **WHEN** a message containing unmatched markup is opened for editing and saved with no change
- **THEN** every visible character is preserved and the overlay still renders those words
  literally

