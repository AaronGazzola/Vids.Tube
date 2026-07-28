# memberships Specification

## Purpose
TBD - created by archiving change channel-membership-model. Update Purpose after archive.
## Requirements
### Requirement: Membership record per channel and community

The system SHALL store memberships in a `memberships` table with exactly one row per (member channel, community channel) pair, enforced by a uniqueness constraint on `(channel_id, community_channel_id)`, with a check constraint preventing a channel from holding a membership in itself. Each row SHALL carry `lifetime_xp` (bigint), `level` (int), `credits` (bigint, default 0), `current_streak` (int), `best_streak` (int), `first_seen_at`, `last_seen_at`, `message_count` (int), `streams_attended` (int), `rewards` (jsonb, default `[]`), `created_at`, and `updated_at`. All values SHALL be scoped to the community; no value SHALL ever transfer between communities.

#### Scenario: One membership per channel per community

- **WHEN** a second membership row is inserted for the same channel and community
- **THEN** the database rejects it via the uniqueness constraint

#### Scenario: A channel cannot join itself

- **WHEN** a membership row is inserted with `channel_id` equal to `community_channel_id`
- **THEN** the database rejects it via the check constraint

### Requirement: Per-stream membership history

The system SHALL store each membership's per-stream history in a `membership_stream_stats` table keyed by `(membership_id, stream_id)`, carrying `xp`, `message_count`, and `stream_started_at`, with rows deleted via cascade when the membership is deleted. This timeline SHALL be the basis from which lifetime XP and streaks are recomputed.

#### Scenario: History rows follow their membership

- **WHEN** a membership row is deleted
- **THEN** all of its `membership_stream_stats` rows are deleted by cascade

### Requirement: Membership aggregates derive from raw events

Every membership value except `credits` and `rewards` SHALL be derivable from raw events alone. For a member channel C in community K, C's identity keys SHALL be `owner_user_id::text` and `'youtube:' || youtube_channel_id` (whichever are non-null). The derivation SHALL be: a stream is attended when C authored at least one `chat_messages` row in it; per-stream XP is `greatest(sum of C's viewer_scores.total_score in the stream, 0)` and 0 when no score rows exist; `lifetime_xp` is the sum of per-stream XP; `message_count`, `first_seen_at`, and `last_seen_at` come from C's `chat_messages` in K's streams; `streams_attended` is the count of attended streams.

#### Scenario: Archive-era stream contributes attendance but no XP

- **WHEN** a membership is recomputed for an identity whose only activity in a stream is archived chat mirrored into `chat_messages` (no `viewer_scores` rows)
- **THEN** that stream counts toward `streams_attended` and `message_count` with an `xp` of 0

#### Scenario: Negative stream score floors at zero

- **WHEN** an identity's `viewer_scores.total_score` for a stream is negative
- **THEN** that stream contributes 0 XP (never negative) to `lifetime_xp`

### Requirement: Level derives from lifetime XP

The system SHALL compute `level` as `level_for_xp(lifetime_xp)`, an immutable SQL function defined as `floor(sqrt(xp / 100))`. Level SHALL never be written except as the output of this function during recompute.

#### Scenario: Level thresholds

- **WHEN** a membership's `lifetime_xp` is 99, 100, 399, or 400
- **THEN** its recomputed `level` is 0, 1, 1, and 2 respectively

### Requirement: Streaks derive from the attendance timeline

Streaks SHALL be computed over community K's ended streams (including synthetic archive-era streams) ordered by `started_at`: `current_streak` is the length of the consecutive attended run ending at K's most recent ended stream, and 0 when that stream was not attended; `best_streak` is the longest attended run in the timeline. Streak values SHALL be flat counters with no multiplier semantics.

#### Scenario: Missing the latest stream zeroes the current streak

- **WHEN** a member attended the 5 streams before K's most recent ended stream but not the most recent one
- **THEN** `current_streak` is 0 and `best_streak` is at least 5

### Requirement: Credits are a balance, not a derived value

The `credits` column SHALL never be modified by recompute. It SHALL only change through explicit operations (spend/award flows arrive in V3; the identity merge sums the two balances).

#### Scenario: Recompute preserves credits

- **WHEN** a membership with a non-zero `credits` balance is recomputed
- **THEN** every derived column is rewritten and `credits` is unchanged

### Requirement: Deterministic recompute routine

The system SHALL provide a `recompute_membership(p_channel_id, p_community_channel_id)` SQL function that derives the membership row and fully rebuilds its `membership_stream_stats` (delete then insert) from raw events, creating the membership when the identity has any history in the community, preserving `credits` and `rewards`, and touching no other membership. The function SHALL be executable by the service role only.

#### Scenario: Recompute is idempotent

- **WHEN** `recompute_membership` runs twice in a row with no new raw events between runs
- **THEN** the second run produces identical membership and stream-stats rows

#### Scenario: Client roles cannot recompute

- **WHEN** an `anon` or `authenticated` role calls `recompute_membership`
- **THEN** the call is rejected (EXECUTE not granted)

### Requirement: Public read, service-role write

`memberships` and `membership_stream_stats` SHALL be publicly readable via RLS (`SELECT using (true)`) and SHALL have no insert/update/delete policies for client roles; all writes go through the service role.

#### Scenario: Anonymous visitor reads membership stats

- **WHEN** an anonymous visitor queries a membership row
- **THEN** the row is returned without authentication

#### Scenario: Client cannot write memberships

- **WHEN** an authenticated client attempts to insert or update a membership row
- **THEN** row-level security rejects the write

