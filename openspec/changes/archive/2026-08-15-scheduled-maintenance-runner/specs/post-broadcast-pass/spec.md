## MODIFIED Requirements

### Requirement: A finished broadcast is completed without a manual step

When a broadcast has ended, the system SHALL settle it in two phases, neither requiring a person
to remember to run anything.

The scoring phase SHALL become ready as soon as the broadcast has ended, and SHALL score the chat,
rebuild the memberships of everyone scored, and check the credit ledger against the chat already
stored. It SHALL NOT fetch the chat replay, because the replay does not exist yet and comparing
against an absent archive is what produced records claiming no gaps.

The settling phase SHALL become ready once the chat replay could plausibly exist, and SHALL save
the broadcast's chat log from the source platform, add any messages the live capture missed, score
what was added, and rebuild the memberships that follow.

Neither phase SHALL run from the live worker.

#### Scenario: A broadcast is scored without waiting for the replay

- **WHEN** a broadcast has ended and carries no completion record
- **THEN** its chat is scored, memberships are rebuilt and the ledger is checked, without any
  attempt to fetch the chat replay

#### Scenario: The replay is merged once it exists

- **WHEN** a broadcast has been scored and enough time has passed for its replay to exist
- **THEN** the chat log is saved, missed messages are added, those messages are scored, and the
  memberships that follow are rebuilt

#### Scenario: The order respects the dependencies

- **WHEN** either phase runs
- **THEN** the chat log is saved before the top-up compares against it, the top-up completes
  before scoring reads the chat, and scoring completes before memberships are rebuilt

### Requirement: The pass records what each step did

The system SHALL store, per broadcast, when each phase last ran, what each step reported, and any
error a step raised. A completion record SHALL distinguish a clean pass from one where a step
failed.

What a step reports SHALL describe that one broadcast. A step whose work spans more than one
broadcast SHALL be scoped to the broadcast being settled, so its report cannot be a total across
unrelated broadcasts stored against whichever one triggered it.

#### Scenario: A clean pass is recorded as clean

- **WHEN** every step succeeds
- **THEN** the record carries each step's result and no error

#### Scenario: A failed step is visible

- **WHEN** a step fails
- **THEN** the record carries that step's error, and the pass is not recorded as clean

#### Scenario: A step's report describes only this broadcast

- **WHEN** a step is backed by a script capable of working across many broadcasts
- **THEN** it is run for this broadcast alone, and the figure stored against the record is that
  broadcast's

### Requirement: A failing step does not silently stop the rest

A step whose failure leaves later steps meaningless SHALL stop the phase and say so. A step whose
failure is independent SHALL be recorded while the phase continues.

A step SHALL be judged by what it reports having done for the broadcast, not by whether its
process exited without an error. A step that saved nothing while there was something to save SHALL
be a failure. A step that saved nothing because there was nothing to save SHALL be recorded as
that, and SHALL NOT be a failure. A step that reports nothing at all SHALL be recorded as unknown,
and unknown SHALL prevent the phase being recorded as clean, because a step that cannot say what
it did has not been shown to have worked.

#### Scenario: Scoring failure stops the rebuild

- **WHEN** scoring fails
- **THEN** the membership rebuild is not run, and the record states why

#### Scenario: An unavailable chat log does not stop scoring

- **WHEN** the chat log cannot be fetched from the source platform
- **THEN** the failure is recorded, and the chat already stored is still scored

#### Scenario: A step that saved nothing is not assumed to have worked

- **WHEN** a step exits without error having saved nothing, while messages were available to save
- **THEN** the step is recorded as failed, and the phase is not recorded as clean

#### Scenario: Nothing to save is its own outcome

- **WHEN** the chat replay is fetched and genuinely holds no messages
- **THEN** the step is recorded as having found none, and is not a failure

#### Scenario: A silent step is not credited

- **WHEN** a step's output carries no statement of what it did
- **THEN** it is recorded as unknown and the phase is not recorded as clean
