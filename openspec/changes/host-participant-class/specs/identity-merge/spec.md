# identity-merge Specification (delta)

## MODIFIED Requirements

### Requirement: Membership collision resolution

When the source (unclaimed) channel and the survivor both hold a membership in the same community, the merge SHALL add the source's `credits` into the survivor's balance and union their `rewards` before deleting the source membership. A source membership whose community is the survivor itself SHALL be dropped rather than carried, because a channel is never a member of its own community, and dropping it SHALL NOT abort the merge. All source memberships are then deleted (stream stats cascade), and `recompute_membership` SHALL run for the survivor in every community where either identity has raw-event history, excluding the survivor's own community.

#### Scenario: Double membership in one community

- **WHEN** both identities held memberships in the same community with credits 30 and 20
- **THEN** the surviving membership has credits 50 and all derived fields freshly recomputed from pooled events

#### Scenario: Streamer claims their own YouTube identity

- **WHEN** the survivor is the community channel and the source held a membership in that same community
- **THEN** that membership is dropped, the merge completes, the source is tombstoned, and the survivor keeps the YouTube channel id

#### Scenario: Recompute skips the survivor's own community

- **WHEN** the merge recomputes memberships across the communities the identity has history in
- **THEN** the survivor's own community is excluded from that loop
