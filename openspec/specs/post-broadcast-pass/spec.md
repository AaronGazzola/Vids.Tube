# post-broadcast-pass Specification

## Purpose
TBD - created by archiving change automatic-post-broadcast-run. Update Purpose after archive.
## Requirements
### Requirement: A finished broadcast is completed without a manual step

When a broadcast ends, the system SHALL run an ordered pass over it: save the broadcast's chat log from the source platform, add any messages the live capture missed, score the chat, rebuild the memberships of everyone scored, and check the credit ledger. No step SHALL require a person to remember to run it.

#### Scenario: A broadcast completes on its own

- **WHEN** a broadcast the worker was engaged with ends
- **THEN** its chat log is saved, missed messages are added, its chat is scored, the memberships of everyone scored are rebuilt, and the ledger is checked

#### Scenario: The order respects the dependencies

- **WHEN** the pass runs
- **THEN** the chat log is saved before the top-up compares against it, the top-up completes before scoring reads the chat, and scoring completes before memberships are rebuilt

### Requirement: A broadcast that ended unattended is caught up

The system SHALL identify any ended broadcast carrying no completion record and run the pass over it when a worker next starts, rather than only handling broadcasts that end while a worker is running.

#### Scenario: A broadcast that ended while nothing was running

- **WHEN** a worker starts and an ended broadcast has no completion record
- **THEN** the pass runs over that broadcast

#### Scenario: Ending out of order is still caught

- **WHEN** a broadcast is marked ended hours after it actually stopped, so a newer broadcast was completed first
- **THEN** the older broadcast is still caught up, because the pass looks for a missing record rather than for recency

### Requirement: The pass records what each step did

The system SHALL store, per broadcast, when the pass last ran, what each step reported, and any error a step raised. A completion record SHALL distinguish a clean pass from one where a step failed.

#### Scenario: A clean pass is recorded as clean

- **WHEN** every step succeeds
- **THEN** the record carries each step's result and no error

#### Scenario: A failed step is visible

- **WHEN** a step fails
- **THEN** the record carries that step's error, and the pass is not recorded as clean

### Requirement: Running the pass again changes nothing

The pass SHALL be safe to run repeatedly. A broadcast already carrying a clean completion record SHALL be skipped, and each individual step SHALL be idempotent so a re-run after a partial failure cannot double-count.

#### Scenario: A second run is a no-op

- **WHEN** the pass runs over a broadcast that already completed cleanly
- **THEN** nothing is written and the broadcast is reported as already done

#### Scenario: A partial failure can be re-run

- **WHEN** the pass failed at scoring and is run again
- **THEN** the earlier steps do not duplicate their work and scoring is attempted afresh

### Requirement: A failing step does not silently stop the rest

A step whose failure leaves later steps meaningless SHALL stop the pass and say so. A step whose failure is independent SHALL be recorded while the pass continues.

#### Scenario: Scoring failure stops the rebuild

- **WHEN** scoring fails
- **THEN** the membership rebuild is not run, and the record states why

#### Scenario: An unavailable chat log does not stop scoring

- **WHEN** the chat log cannot be fetched from the source platform
- **THEN** the failure is recorded, and the chat already stored is still scored

