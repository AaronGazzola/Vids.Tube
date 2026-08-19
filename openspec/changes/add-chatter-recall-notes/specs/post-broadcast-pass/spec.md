## MODIFIED Requirements

### Requirement: A finished broadcast is completed without a manual step

When a broadcast has ended, the system SHALL settle it in two phases, neither requiring a person
to remember to run anything.

The scoring phase SHALL become ready as soon as the broadcast has ended, and SHALL score the chat,
rebuild the memberships of everyone scored, check the credit ledger against the chat already
stored, and write the remembering points for everyone who spoke. It SHALL NOT fetch the chat
replay, because the replay does not exist yet and comparing against an absent archive is what
produced records claiming no gaps.

The settling phase SHALL become ready once the chat replay could plausibly exist, and SHALL save
the broadcast's chat log from the source platform, add any messages the live capture missed, score
what was added, rebuild the memberships that follow, and write the remembering points again so they
account for the messages the replay added.

Writing remembering points SHALL be the last step of both phases, and SHALL depend on the membership
rebuild, so notes are never written against totals that failed to rebuild.

Neither phase SHALL run from the live worker.

#### Scenario: A broadcast is scored without waiting for the replay

- **WHEN** a broadcast has ended and carries no completion record
- **THEN** its chat is scored, memberships are rebuilt, the ledger is checked and remembering points
  are written, without any attempt to fetch the chat replay

#### Scenario: The replay is merged once it exists

- **WHEN** a broadcast has been scored and enough time has passed for its replay to exist
- **THEN** the chat log is saved, missed messages are added, those messages are scored, the
  memberships that follow are rebuilt, and the remembering points are written again

#### Scenario: The order respects the dependencies

- **WHEN** either phase runs
- **THEN** the chat log is saved before the top-up compares against it, the top-up completes
  before scoring reads the chat, scoring completes before memberships are rebuilt, and memberships
  are rebuilt before remembering points are written

#### Scenario: A failed rebuild stops the notes

- **WHEN** the membership rebuild fails
- **THEN** no remembering points are written for that broadcast, and the record states why

#### Scenario: A broadcast already settled is not reopened

- **GIVEN** a broadcast recorded as settled before remembering points became a step
- **WHEN** the maintenance sweep runs
- **THEN** that broadcast is not picked up again, because settled remains a separate claim from the
  set of steps a phase now runs
