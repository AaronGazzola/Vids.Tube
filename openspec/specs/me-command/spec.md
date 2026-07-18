# me-command Specification

## Purpose

Give every chatter a !me command that answers with a warm cached AI mini-bio
of their history on the channel, merging YouTube archive stats with vids.tube
scoring when their handle link is verified, capped at 400 characters.

## Requirements

### Requirement: Identity resolution and merging

The system SHALL resolve a `!me` caller's identity as: YouTube-origin callers by
their author channel id; vids.tube callers by their user id, additionally merged
with their YouTube history when (and only when) they have a **verified**
`youtube_links` row. The merged identity SHALL share one cached profile keyed by
the YouTube channel id, so the same person gets the same bio from either chat.

#### Scenario: Verified link merges history

- **WHEN** a vids.tube user with a verified YouTube link calls `!me`
- **THEN** the bio draws on both their vids.tube scoring history and their
  YouTube archive stats

#### Scenario: Unverified link does not merge

- **WHEN** a vids.tube user with an unverified link calls `!me`
- **THEN** only their vids.tube history is used

### Requirement: Cached AI profile with regeneration thresholds

The system SHALL cache each identity's generated bio in `me_profiles` with the
stats snapshot it was generated from, serving the cache instantly and
regenerating via the worker's Claude CLI only when total messages moved by at
least 20 or the attended videos/streams count changed. The bio SHALL be warm and
playful, grounded only in the gathered stats, and SHALL never exceed 400
characters — enforced by prompt instruction and by truncation before caching.

#### Scenario: Cache hit is instant

- **WHEN** a chatter repeats `!me` with unchanged stats (outside the cooldown)
- **THEN** the cached bio is replied without any AI call

#### Scenario: Stats movement regenerates

- **WHEN** a chatter's total messages have grown by 20 or they attended a new
  stream since generation
- **THEN** the next `!me` regenerates the bio and updates the cache

#### Scenario: Hard length cap

- **WHEN** the model returns text longer than 400 characters
- **THEN** the stored and delivered bio is truncated to at most 400 characters

### Requirement: First-timer welcome

The system SHALL reply to a caller with no history on any platform with a fixed
warm welcome line (no AI call), inviting them to stick around.

#### Scenario: Unknown chatter

- **WHEN** a chatter with no archive, no stats, and no scoring history calls
  `!me`
- **THEN** they receive the fixed welcome reply and no profile row is created
