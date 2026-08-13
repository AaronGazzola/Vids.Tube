## ADDED Requirements

### Requirement: The live page header reflows on small screens

The `/live` header SHALL place the tab list on its own line above the mod indicators, the
Activity demo switch and the pop-out button whenever the viewport is too narrow to hold them
all on one line, and SHALL keep them on a single line otherwise. No control SHALL be clipped
at any width.

#### Scenario: Narrow viewport stacks the header

- **WHEN** the live page is viewed on a narrow screen with the Activity tab open
- **THEN** the tabs occupy their own line, with the mod indicators, the demo switch and the
  pop-out button on the line beneath, and no control is clipped

#### Scenario: Wide viewport keeps one line

- **WHEN** the live page is viewed on a wide screen
- **THEN** the tabs and the other controls share a single line as they do today
