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

### Requirement: Points reward quality rather than volume

A message's quality SHALL be the highest of its criteria rather than their sum, so a message that excels at one thing is not marked down for the others. Points SHALL be zero below a configured quality threshold and SHALL rise on a curve above it, so a chatter sending many unremarkable messages earns nothing while a chatter sending a few good ones earns. The threshold, the curve and the ceiling SHALL live in the shared configuration.

#### Scenario: Ordinary chat earns nothing

- **WHEN** a message is rated at or below the threshold on every criterion
- **THEN** it earns zero points

#### Scenario: Excelling at one thing is enough

- **WHEN** a message is rated highly for humour and at zero for the other criteria
- **THEN** it earns more than a message rated moderately on all three

#### Scenario: Volume loses to quality

- **WHEN** one chatter sends a hundred messages rated below the threshold and another sends five rated well above it
- **THEN** the second chatter earns more

### Requirement: Points can be re-derived without re-scoring

Each rating SHALL store the per-message criteria and text that produced it, so a changed threshold, curve or ceiling can be applied by recomputing from stored ratings, with no further model calls. Only a change to the rubric itself SHALL require re-scoring.

#### Scenario: A calibration change costs no model calls

- **WHEN** the point ceiling is changed and the re-derive pass is run
- **THEN** every affected rating, per-broadcast score and membership is updated from the stored criteria, and the model is not called

#### Scenario: A rating without a breakdown is reported, not guessed

- **WHEN** the re-derive pass meets a rating that carries no per-message breakdown
- **THEN** it reports how many such ratings exist and leaves them unchanged
