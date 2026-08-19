## ADDED Requirements

### Requirement: A new membership is granted credits on joining

A membership SHALL be granted a fixed number of credits at the moment it is created. The amount SHALL be
five.

The grant SHALL be written as a ledger line of its own kind, distinct from an earning and from a spend, so
that the ledger continues to reconcile against the balance cached on the membership.

The grant SHALL NOT be derived from XP and SHALL NOT be rewritten by a recompute. A re-score SHALL rebuild
every credit earned without touching the grant, exactly as it already leaves a spend alone.

#### Scenario: A first-time chatter joins

- **GIVEN** someone chatting in a community for the first time
- **WHEN** their membership is created
- **THEN** a grant line of five credits is written and their balance is five

#### Scenario: The ledger still reconciles

- **WHEN** the credit ledger is verified after a grant
- **THEN** the sum of the ledger lines equals the balance cached on the membership

#### Scenario: A re-score leaves the grant alone

- **GIVEN** a member holding a grant and an earning
- **WHEN** their membership is recomputed and their earning changes
- **THEN** the earning is rewritten and the grant is unchanged

### Requirement: The joining grant is made once and never repeated

A membership SHALL carry at most one joining grant, for its whole existence.

Recomputing a membership, running the post-broadcast pass, replaying a broadcast, or rebuilding every
membership in the database SHALL NOT produce a second grant.

Being granted once SHALL be enforced by the database rather than by a check the caller performs, so no
future caller can create a second grant by not knowing to look.

#### Scenario: A rebuild does not re-grant

- **GIVEN** a member who was granted credits when they joined
- **WHEN** every membership in the database is recomputed
- **THEN** their balance is unchanged and exactly one grant line exists

#### Scenario: A returning member is not re-granted

- **GIVEN** an existing member of a community
- **WHEN** they chat in a later broadcast
- **THEN** no further grant is made

#### Scenario: A second grant is refused

- **WHEN** a second joining grant is attempted for a membership that already holds one
- **THEN** it is rejected, and the first grant is unchanged

### Requirement: The host and software accounts are not granted

The host SHALL NOT be granted joining credits in their own community, holding no membership there to
grant against.

A software account SHALL NOT be granted joining credits.

#### Scenario: The host chats in their own community

- **WHEN** the host chats during their own broadcast
- **THEN** no grant line is written

#### Scenario: A bot chats

- **GIVEN** a channel marked as software
- **WHEN** a membership would be created for it
- **THEN** no grant line is written
