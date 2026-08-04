# memberships Specification (delta)

## ADDED Requirements

### Requirement: The host holds no membership in their own community

The system SHALL NOT create, carry, or recompute a membership whose member
channel is the community channel itself. Host activity SHALL be represented by
raw `chat_messages` rows attributed to the channel owner, never by a membership
row, and SHALL therefore never appear in a member count, roster, leaderboard, or
streak list for the community they host.

#### Scenario: Recompute is asked to build a self-membership

- **WHEN** `recompute_membership` is called with the same channel as member and
  community
- **THEN** it returns without creating or updating any row

#### Scenario: Merge would carry a self-membership

- **WHEN** the merge survivor is the community channel and the source held a
  membership in that community
- **THEN** the membership is dropped rather than carried, and the merge completes

#### Scenario: Host is absent from community aggregates

- **WHEN** a community's member count, roster, or leaderboard is produced
- **THEN** the host's own channel appears in none of them
