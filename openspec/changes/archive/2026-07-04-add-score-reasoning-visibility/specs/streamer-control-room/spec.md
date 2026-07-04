## ADDED Requirements

### Requirement: Leaderboard entries expose the AI's scoring reasoning

The control room leaderboard SHALL let the owner reveal, per viewer, the AI's reasoning
behind that viewer's score: the recent per-message dimension breakdown (engagement,
humour, contribution), the points each message earned, and any feature reasons. The
reasoning SHALL load on demand (only when the owner expands an entry), so it does not add
queries for collapsed entries.

#### Scenario: Owner reveals why a viewer is ranked where they are

- **WHEN** the owner expands a viewer on the control-room leaderboard
- **THEN** the viewer's recent messages are shown with their engagement/humour/contribution
  scores and the points each earned, plus any reason the AI gave for featuring them

#### Scenario: Reasoning is not fetched until requested

- **WHEN** the leaderboard renders with all entries collapsed
- **THEN** no per-viewer reasoning query is issued until the owner expands an entry
