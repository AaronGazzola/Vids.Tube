## MODIFIED Requirements

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

## ADDED Requirements

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
