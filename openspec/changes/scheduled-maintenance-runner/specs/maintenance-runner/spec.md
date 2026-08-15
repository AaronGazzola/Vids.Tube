## ADDED Requirements

### Requirement: A sweep is one invocation that exits

The system SHALL provide a maintenance command that performs one sweep over the broadcasts owing
work and then exits. It SHALL NOT run as a long-lived process, because a wedged process stops
silently and a scheduled invocation cannot.

A sweep SHALL settle at most a small fixed number of broadcasts, so a backlog cannot turn one
invocation into hours of work, and SHALL report how many it left for the next sweep rather than
leaving the remainder unmentioned.

#### Scenario: A sweep with nothing owing

- **WHEN** the command runs and no broadcast owes work
- **THEN** it reports that nothing was owing and exits

#### Scenario: A backlog is worked through across sweeps

- **WHEN** more broadcasts owe work than one sweep handles
- **THEN** the sweep handles its limit, states how many remain, and exits, and the next sweep
  continues from where it stopped

#### Scenario: A crash costs one sweep

- **WHEN** an invocation fails part-way
- **THEN** the next scheduled invocation starts afresh, and any broadcast left part-settled is
  picked up again because it is still recorded as owing work

### Requirement: The runner refuses to start without what it needs

The runner SHALL check, before its first pass, that it has the chat replay downloader, the Claude
command used for scoring, and the secrets for the production configuration, and SHALL exit with a
statement of what is missing rather than beginning work without it.

A missing dependency SHALL NOT be recorded as a step failure against a broadcast, because the
broadcast is not at fault and the record would suggest the data is bad rather than the machine.

#### Scenario: A machine missing a dependency

- **WHEN** the runner starts on a machine without the chat replay downloader
- **THEN** it names what is missing and exits, and no completion record is written

#### Scenario: A prepared machine

- **WHEN** every dependency is present
- **THEN** the preflight passes silently and the sweep proceeds

### Requirement: Scoring does not wait for the replay

A broadcast that has ended and carries no completion record SHALL be scored on the next sweep,
without waiting for its chat replay. Credits, points and memberships from a broadcast SHALL NOT be
withheld for the day or more that a replay takes to become available.

#### Scenario: A broadcast is scored the same evening

- **WHEN** a broadcast ends and a sweep runs afterwards
- **THEN** its chat is scored and its memberships are rebuilt on that sweep

### Requirement: The replay is merged once it could exist, and waited for only so long

A broadcast SHALL become eligible for its replay to be sought once at least 20 hours have passed
since it ended, that being inside the observed 16 to 24 hour window before a YouTube chat replay
becomes downloadable.

A fetch returning no messages SHALL NOT settle the broadcast, so a wait that proves too short
corrects itself on a later sweep.

A broadcast whose replay has still produced nothing 7 days after it ended SHALL be settled and
recorded as having had no replay available. This SHALL be stored as a statement distinct from
having merged one, so a broadcast closed by the time limit is never mistaken for a complete one.
The 8-Aug-2026 broadcast established that a replay can fail to appear at all.

#### Scenario: Too early for the replay

- **WHEN** a sweep runs an hour after a broadcast ended
- **THEN** the replay is not sought, and the broadcast stays unsettled

#### Scenario: The replay is merged

- **WHEN** a sweep runs a day after a broadcast ended and the replay holds messages
- **THEN** the messages missing from the stored chat are added, scored, and the broadcast is
  settled as merged

#### Scenario: The replay is not ready yet

- **WHEN** the replay is sought at 20 hours and returns no messages
- **THEN** the broadcast stays unsettled and is sought again on a later sweep

#### Scenario: The replay never arrives

- **WHEN** 7 days have passed since the broadcast ended and every fetch has returned no messages
- **THEN** the broadcast is settled and recorded as having had no replay available, which is not
  the same record as having merged one

### Requirement: Settled is a separate claim from clean

The system SHALL record separately that a phase's steps all succeeded and that a broadcast's chat
replay has been accounted for. A broadcast SHALL be selected for work by not being settled, rather
than by carrying no record, so a record never has to be un-written when a replay arrives later.

#### Scenario: A scored broadcast is still owed its replay

- **WHEN** a broadcast has been scored cleanly but its replay has not been accounted for
- **THEN** it is reported as not settled and is picked up by a later sweep

#### Scenario: A settled broadcast is left alone

- **WHEN** a broadcast has been settled
- **THEN** no sweep works on it again

#### Scenario: An unattended broadcast is still caught

- **WHEN** a broadcast ended while nothing was running and carries no record at all
- **THEN** it is treated as owing the scoring phase, as before
