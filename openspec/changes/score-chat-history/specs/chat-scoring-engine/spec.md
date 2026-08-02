## ADDED Requirements

### Requirement: The scoring rubric is a versioned configuration

The rubric that tells the model what to reward SHALL live in one shared configuration carrying the criteria, the site-message multiplier, the rubric text, and a version string. The live scorer and the history backfill SHALL both read that configuration, so neither can drift from the other. The version SHALL be a deliberately chosen string, changed when the wording changes, rather than derived from the text.

#### Scenario: Both paths use the same rubric

- **WHEN** the rubric text is changed in the configuration
- **THEN** the live scorer and the backfill both use the changed wording, with no second copy to update

#### Scenario: The version marks a decision, not an edit

- **WHEN** the rubric text is reformatted without changing what it asks for
- **THEN** the version is unchanged unless it is deliberately bumped

### Requirement: Every rating records the configuration that produced it

Each `score_events` row SHALL carry the version of the scoring configuration that produced it. This SHALL make it possible to attribute a chatter's standing to a rubric, to clear exactly one version's ratings before a re-run, and to compare two configurations on the same broadcast without one destroying the other's evidence.

#### Scenario: A rating is attributable

- **WHEN** a rating is written by either the live scorer or the backfill
- **THEN** it carries the version of the configuration in force at the time

#### Scenario: One version can be cleared without touching another

- **WHEN** ratings from two configuration versions exist for a broadcast and one version is cleared
- **THEN** only that version's ratings are removed
