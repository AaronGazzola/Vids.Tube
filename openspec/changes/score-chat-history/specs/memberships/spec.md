## MODIFIED Requirements

### Requirement: Level derives from lifetime XP

The system SHALL compute `level` as `level_for_xp(lifetime_xp)`, an immutable SQL function defined as `floor(sqrt(xp / 25))`. Level SHALL never be written except as the output of this function during recompute.

The divisor was lowered from 100 to 25 because the original curve was set when a single message could pay over 100 points. Under quality-weighted scoring the most prolific chatter in a year of broadcasts would have reached level 2. At 25, the busiest contributor lands near level 9, a regular attender near level 4, and an occasional chatter at level 0 or 1.

#### Scenario: Levels follow the curve

- **WHEN** a membership holds 0, 25, 100, or 225 lifetime XP
- **THEN** its recomputed `level` is 0, 1, 2, and 3 respectively

#### Scenario: Level is never written directly

- **WHEN** a membership is recomputed
- **THEN** its level is the output of the level function for its lifetime XP, and no other value can be stored
