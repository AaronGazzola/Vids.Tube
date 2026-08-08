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

The system SHALL compute `level` as `level_for_xp(lifetime_xp)`, an immutable SQL function defined as `floor(sqrt(xp / 25))`. Level SHALL never be written except as the output of this function during recompute.

The divisor was lowered from 100 to 25 because the original curve was set when a single message could pay over 100 points. Under quality-weighted scoring the most prolific chatter in a year of broadcasts would have reached level 2. At 25, the busiest contributor lands near level 9, a regular attender near level 4, and an occasional chatter at level 0 or 1.

#### Scenario: Levels follow the curve

- **WHEN** a membership holds 0, 25, 100, or 225 lifetime XP
- **THEN** its recomputed `level` is 0, 1, 2, and 3 respectively

#### Scenario: Level is never written directly

- **WHEN** a membership is recomputed
- **THEN** its level is the output of the level function for its lifetime XP, and no other value can be stored

### Requirement: Streaks derive from the attendance timeline

Streaks SHALL be computed over a timeline of community K's streams ordered by `started_at`, comprising every ended stream (including synthetic archive-era streams) plus K's running stream when and only when the member has attended it: `current_streak` is the length of the consecutive attended run ending at the last stream in that timeline, and 0 when that stream was not attended; `best_streak` is the longest attended run in the timeline. Streak values SHALL be flat counters with no multiplier semantics.

A running stream is admitted only once attended so that attendance counts while the stream is still live, without zeroing the streak of every member the moment a stream goes live.

#### Scenario: Missing the latest stream zeroes the current streak

- **WHEN** a member attended the 5 streams before K's most recent ended stream but not the most recent one
- **THEN** `current_streak` is 0 and `best_streak` is at least 5

#### Scenario: Chatting in the running stream lifts the streak immediately

- **WHEN** a member attended K's most recent ended stream and then chats in K's currently running stream
- **THEN** `current_streak` counts both, without waiting for the running stream to end

#### Scenario: A live stream nobody has attended leaves streaks alone

- **WHEN** K's stream goes live and a member has not chatted in it
- **THEN** that member's `current_streak` is unchanged from its value before the stream went live

### Requirement: Credits are a balance, not a derived value

The `credits` column SHALL be a cached copy of the membership's credit-ledger balance. `recompute_membership` SHALL rewrite that membership's single earning line from its lifetime XP and SHALL rewrite `credits` to the resulting ledger sum. Recompute SHALL NOT create, modify or delete any spending line, so credits already spent SHALL survive any number of recomputes and any re-score. The ledger SHALL be the source of truth and `credits` SHALL never be modified independently of it.

#### Scenario: Recompute preserves spends

- **WHEN** a membership holding a spending line is recomputed
- **THEN** every derived column is rewritten, the spending line is unchanged, and `credits` equals the sum of the membership's ledger lines

#### Scenario: Recompute rewrites earnings from XP

- **WHEN** a membership's lifetime XP changes and it is recomputed
- **THEN** its earning line and `credits` both reflect the new XP total

### Requirement: Deterministic recompute routine

The system SHALL provide a `recompute_membership(p_channel_id, p_community_channel_id)` SQL function that derives the membership row and fully rebuilds its `membership_stream_stats` (delete then insert) from raw events, creating the membership when the identity has any history in the community, preserving `credits` and `rewards`, and touching no other membership. Where the identity has no history in the community and a membership already exists, the function SHALL clear that membership's per-broadcast rows and zero its derived columns rather than leaving stale values in place. The function SHALL be executable by the service role only.

#### Scenario: Recompute is idempotent

- **WHEN** `recompute_membership` runs twice in a row with no new raw events between runs
- **THEN** the second run produces identical membership and stream-stats rows

#### Scenario: Client roles cannot recompute

- **WHEN** an `anon` or `authenticated` role calls `recompute_membership`
- **THEN** the call is rejected (EXECUTE not granted)

#### Scenario: A membership whose history disappears is zeroed

- **WHEN** every message behind a membership is deleted and the membership is recomputed
- **THEN** its per-broadcast rows are removed and its experience, level, message count, attendance and streaks are all zero, while its credits and rewards are untouched

#### Scenario: No membership is created for an identity with no history

- **WHEN** `recompute_membership` runs for a channel with no messages in the community and no existing membership
- **THEN** no membership row is created

### Requirement: Public read, service-role write

`memberships` and `membership_stream_stats` SHALL be publicly readable via RLS (`SELECT using (true)`) and SHALL have no insert/update/delete policies for client roles; all writes go through the service role.

#### Scenario: Anonymous visitor reads membership stats

- **WHEN** an anonymous visitor queries a membership row
- **THEN** the row is returned without authentication

#### Scenario: Client cannot write memberships

- **WHEN** an authenticated client attempts to insert or update a membership row
- **THEN** row-level security rejects the write

### Requirement: Memberships refresh live during a broadcast

At the end of each scoring batch, the worker SHALL call `recompute_membership` once for each participant scored in that batch, against the broadcast's community. A participant's XP, level, message count, broadcasts attended, streaks and credit balance SHALL therefore reflect their participation while the broadcast is still running.

#### Scenario: Standing moves during the broadcast

- **WHEN** a chatter's messages are scored in a batch during a live broadcast
- **THEN** their membership's XP, level and message count reflect those messages without any script being run

#### Scenario: Credits are spendable in the broadcast that earned them

- **WHEN** a chatter earns credits in one scoring batch and spends them later in the same broadcast
- **THEN** the spend is permitted against the balance earned during that broadcast

#### Scenario: Live values equal rebuilt values

- **WHEN** a membership updated live during a broadcast is recomputed again after the broadcast ends, with no new messages between
- **THEN** every column holds the same value as it did before the second recompute

#### Scenario: Only scored participants are refreshed

- **WHEN** a scoring batch contains messages from two chatters out of a hundred with memberships
- **THEN** only those two memberships are recomputed

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

