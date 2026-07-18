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
regenerating via the worker's Claude CLI when any of these hold: total
messages moved by at least 20, the attended videos/streams count changed, or
the cached bio was generated before the engaged stream started — so every
stream gets a fresh bio on first use. The bio SHALL be written in the third
person using the chatter's display name, warm and playful, grounded only in
the gathered stats plus a sample of the chatter's own recent messages (up to
8 recent `chat_messages` for the identity and up to 8 recent
`youtube_chat_archive` messages by channel id, each clipped to 120
characters) so it can nod to what they actually talk about. The bio SHALL
never exceed 400 characters — enforced by prompt instruction and by
truncation before caching.

#### Scenario: Cache hit is instant within a stream

- **WHEN** a chatter repeats `!me` in the same stream with unchanged stats
- **THEN** the cached bio is replied without any AI call

#### Scenario: New stream regenerates

- **WHEN** a chatter uses `!me` and the cached bio predates the current
  stream's start
- **THEN** the bio regenerates before replying and the cache is updated

#### Scenario: Third person with tidbits

- **WHEN** a bio is generated for a chatter with message history
- **THEN** it refers to them by name in the third person and may reference
  the kinds of things they say in chat, drawn only from the sampled messages

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

### Requirement: Live-accruing stats

The system SHALL keep `!me` stats current from live-captured chat without
requiring the YouTube backfill to rerun: message totals SHALL combine the
`chatter_stats` archive with `chat_messages` rows recorded after the
chatter's archive watermark (`last_seen_at`; all rows when the chatter has no
archive entry), streams attended SHALL grow by the distinct live streams the
chatter spoke in after the watermark, the identity's own vids.tube messages
SHALL count toward the total, and first-seen SHALL fall back to the earliest
live message when no archive entry exists.

#### Scenario: New stream grows the totals without a backfill

- **WHEN** a chatter sends messages during a live stream and later uses `!me`
  with no backfill rerun in between
- **THEN** their message total and attended-stream count include the new
  stream's activity

#### Scenario: Archive plus live never double-counts

- **WHEN** a chatter has archived history and new live messages
- **THEN** only messages after the archive watermark are added to the
  archived total

#### Scenario: Live-only chatter

- **WHEN** a chatter has no archive entry but has live-captured messages
- **THEN** their stats derive entirely from `chat_messages`, including
  first-seen
