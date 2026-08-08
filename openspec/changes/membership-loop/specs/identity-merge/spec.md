## ADDED Requirements

### Requirement: A merge target may not itself be a tombstone

The database SHALL reject setting `merged_into_channel_id` to a channel that already has its own `merged_into_channel_id` set. A chain of tombstones is therefore impossible.

This exists because every lookup that resolves a chatter follows the tombstone pointer exactly once. A two-step chain would resolve to a channel that is itself retired, and the chatter would be treated as brand new — losing their history and their membership. Forbidding the chain is preferred over teaching every lookup to follow it, because the rule is enforced in one place and cannot be forgotten at a call site.

#### Scenario: A chain is rejected

- **WHEN** a merge attempts to retire a channel into a channel that is already retired
- **THEN** the database rejects the write and nothing changes

#### Scenario: An ordinary merge still succeeds

- **WHEN** a merge retires an unclaimed channel into a channel that is not itself retired
- **THEN** the merge completes as before

#### Scenario: One hop always suffices

- **WHEN** a chatter is resolved from a YouTube account whose channel is a tombstone
- **THEN** following the pointer once reaches a live channel, because no tombstone can point at another tombstone
