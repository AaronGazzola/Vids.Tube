## MODIFIED Requirements

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

The editable field itself SHALL render with the overlay's own typography and backing, and SHALL
show the member count beside the message as the overlay does, so the line's real width and
legibility are visible while writing. No separate preview SHALL be required to judge the result.

#### Scenario: The field reflects an edit

- **WHEN** the streamer changes a message's text or formatting
- **THEN** the field itself shows the rendered result immediately

#### Scenario: The field uses the overlay's backing

- **WHEN** a message is being edited
- **THEN** it is drawn on the same backing the banner uses, so a colour that would be
  unreadable on air is unreadable while editing

#### Scenario: The count is shown but not editable

- **WHEN** the streamer edits the first message
- **THEN** the member count is shown beside it as the overlay draws it, and cannot be typed into

## ADDED Requirements

### Requirement: Markup and styled text round-trip without loss

Parsing a message into styled runs and serializing those runs back to markup SHALL reproduce
the original message exactly, for every form the parser supports. Malformed markup SHALL
survive the round trip as its own literal text, unchanged.

#### Scenario: A formatted message survives editing

- **WHEN** a message carrying bold, italic, underline and colour is opened for editing and saved
  again with no change
- **THEN** the stored message is byte-identical to what it was

#### Scenario: Malformed markup is not rewritten

- **WHEN** a message containing unmatched markup is opened for editing and saved with no change
- **THEN** the stored message is unchanged, and the overlay still renders its words literally
