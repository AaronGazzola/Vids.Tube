# chat-overlay-scoring Specification

## Purpose
TBD - created by archiving change add-score-reasoning-visibility. Update Purpose after archive.
## Requirements
### Requirement: Persisted per-message score breakdown

The scorer SHALL persist the per-message dimension breakdown it already obtains from the
model — `engagement`, `humour`, and `contribution` (each 0-100) plus the weighted `points`
the message earned — for every scored message, without making any additional model call.
The breakdown SHALL be stored on the participant's `score_events` row (in the existing
`metadata` jsonb) so a viewer's `total_score` is explainable after the fact.

#### Scenario: Breakdown is captured for scored messages

- **WHEN** the bot scores a batch of chat messages
- **THEN** each scoring participant's `score_events` row records, per message, the three
  dimension scores and the points earned, alongside the feature reasons already stored
- **AND** no extra model request is issued to produce it (the data comes from the response
  the model already returned)

#### Scenario: Aggregate score remains unchanged

- **WHEN** the breakdown is persisted
- **THEN** `viewer_scores.total_score` and the leaderboard ordering are computed exactly as
  before — persisting the breakdown is additive and does not alter scoring

