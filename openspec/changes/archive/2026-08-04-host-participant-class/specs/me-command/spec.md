# me-command Specification (delta)

## MODIFIED Requirements

### Requirement: Identity resolution and merging

The system SHALL resolve a `!me` caller's identity as: **host callers** by the
community channel they own, when the caller's YouTube author channel id matches
the broadcast's YouTube channel id; other YouTube-origin callers by their author
channel id; vids.tube callers by their user id, additionally merged with their
YouTube history when (and only when) they have a **verified** `youtube_links`
row. The merged identity SHALL share one cached profile keyed by the YouTube
channel id, so the same person gets the same bio from either chat.

#### Scenario: Verified link merges history

- **WHEN** a vids.tube user with a verified YouTube link calls `!me`
- **THEN** the bio draws on both their vids.tube scoring history and their
  YouTube archive stats

#### Scenario: Unverified link does not merge

- **WHEN** a vids.tube user with an unverified link calls `!me`
- **THEN** only their vids.tube history is used

#### Scenario: Host resolves as the community, not a chatter

- **WHEN** the host calls `!me` in their own stream
- **THEN** the caller resolves to the community channel and not to any chatter
  identity, whether or not their link is verified

## ADDED Requirements

### Requirement: Host reply is community-scoped and never prompts a claim

The system SHALL answer a host `!me` with community-scoped figures (members,
messages so far in the current stream, streams to date) drawn from a single
source, and SHALL NOT include XP, level, rank, streak, or the unclaimed-identity
claim prompt.

#### Scenario: Host calls the command mid-stream

- **WHEN** the host sends `!me` during their own stream
- **THEN** the bot replies with community-scoped figures and no rank, level, or
  claim line

#### Scenario: Host with an unclaimed duplicate identity

- **WHEN** the host calls `!me` while an unclaimed channel still exists for
  their YouTube id
- **THEN** the reply contains no claim prompt and no link to that profile
