## MODIFIED Requirements

### Requirement: The editor shows the message as the overlay will draw it

The banner rendering itself SHALL be the editable surface: the banner is drawn at its real
proportions on its real backing, scaled to fit the settings column, and its message text is
typed directly into it. No separate text field SHALL exist.

The message SHALL render as styled text while it is typed, so bold, italic, underline and colour
are seen as they are applied rather than as markup. A message's metric and icon SHALL render
beside the text as they will on air, and SHALL NOT be editable inline, because a number pulled
live is not something to type over.

#### Scenario: Typing into the banner itself

- **WHEN** the streamer types a message
- **THEN** the characters appear in the banner rendering, styled, on the banner's own backing

#### Scenario: There is nothing else to look at

- **WHEN** a message is being edited
- **THEN** no separate preview is shown, because the thing being edited is the thing that goes
  on air

#### Scenario: The metric is shown but not typed into

- **WHEN** a message carries a metric
- **THEN** its number and icon are drawn beside the text as the overlay draws them, and the
  caret cannot be placed in them
