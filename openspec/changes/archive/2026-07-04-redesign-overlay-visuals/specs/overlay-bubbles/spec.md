## ADDED Requirements

### Requirement: Rank-aware avatar bubble

The system SHALL provide an `AvatarBubble` that draws a viewer's avatar inside a
circular progress ring and, for the top three, a 1/2/3 rank badge. The ring SHALL fill
to the viewer's standing — `progress = score / leaderScore`, full for first place — and
its colour (and the badge outline) SHALL be gold for rank 1, silver for rank 2, bronze
for rank 3, and translucent grey otherwise. Standing SHALL come from a pure
`computeStandings(scores)` helper that returns `{ rank, progress }` per participant.

#### Scenario: First place shows a full ring

- **WHEN** a viewer has the highest score
- **THEN** their bubble's ring is full and coloured gold with a "1" badge

#### Scenario: Ring is relative to the leader

- **WHEN** a non-leading viewer's score is half the leader's
- **THEN** their ring is about half full

#### Scenario: Rank colours and badges

- **WHEN** viewers rank 2nd and 3rd
- **THEN** their rings/badges are silver and bronze; viewers below 3rd have a grey ring
  and no badge

### Requirement: Floating-bubbles competition overlay

The competition overlay SHALL render every viewer with a score as an `AvatarBubble`
drifting at low opacity within the bottom third of the screen (replacing the plant
competition). Bubbles SHALL be ranked/coloured per the standings and SHALL float
independently. The plant component and its growth helper SHALL be removed.

#### Scenario: Scored viewers float as bubbles

- **WHEN** the competition overlay is live with scored viewers
- **THEN** each appears as a low-opacity, drifting avatar bubble in the bottom third,
  ringed and badged by rank

#### Scenario: No plants remain

- **WHEN** the competition overlay renders
- **THEN** it uses avatar bubbles, not plants
