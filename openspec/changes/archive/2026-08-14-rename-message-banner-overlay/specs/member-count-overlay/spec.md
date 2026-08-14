## RENAMED Requirements

- FROM: `### Requirement: The members box replaces the subs goal box`
- TO: `### Requirement: The message banner replaces the subs goal box`

- FROM: `### Requirement: The members box shows the count and the call to action`
- TO: `### Requirement: The message banner shows the count and the call to action`

- FROM: `### Requirement: The members box is a thin horizontal strip`
- TO: `### Requirement: The message banner is a thin horizontal strip`

- FROM: `### Requirement: The strip cycles through the streamer's messages`
- TO: `### Requirement: The message banner cycles through the streamer's messages`

## ADDED Requirements

### Requirement: The overlay is named the message banner

The overlay SHALL be called the "message banner" wherever it is named: in the overlay control
panel, in the Settings tab, in the stored layout key, and in the test identifiers the browser
specs read. The former name, "members", SHALL NOT remain in any of those places.

#### Scenario: The owner sees one name

- **WHEN** the owner opens the Overlays tab and the Settings tab
- **THEN** the overlay is called the message banner in both, and nowhere is it called members

### Requirement: Saved layouts are migrated to the new key

A migration SHALL move the overlay's entries in each saved layout's `boxes`, `visible` and
`boxOpacity` from the `members` key to the `messageBanner` key, preserving position, scale,
visibility and opacity exactly. The migration SHALL be idempotent, SHALL leave a layout that
already carries the new key untouched, and SHALL disturb no other overlay's entries.

#### Scenario: An existing layout keeps its position

- **WHEN** a saved layout positions the overlay away from its default and the migration runs
- **THEN** the overlay is stored under the new key with the same position, scale, visibility and
  opacity, and renders exactly where it did before

#### Scenario: Running twice changes nothing

- **WHEN** the migration is applied a second time
- **THEN** every saved layout is unchanged

#### Scenario: Other overlays are untouched

- **WHEN** the migration runs against a layout carrying every overlay
- **THEN** only the message banner's entries move, and every other overlay keeps its position,
  scale, visibility and opacity

### Requirement: One default message

The default layout SHALL carry exactly one message, "Chat to become a member at Vids.Tube!".
No further message SHALL be seeded.

#### Scenario: A fresh layout has one message

- **WHEN** a channel with no saved layout is loaded
- **THEN** the message banner carries exactly one message, the call to action, beside the count
