## MODIFIED Requirements

### Requirement: Credits are a balance, not a derived value

The `credits` column SHALL be a cached copy of the membership's credit-ledger balance. `recompute_membership` SHALL rewrite that membership's single earning line from its lifetime XP and SHALL rewrite `credits` to the resulting ledger sum. Recompute SHALL NOT create, modify or delete any spending line, so credits already spent SHALL survive any number of recomputes and any re-score. The ledger SHALL be the source of truth and `credits` SHALL never be modified independently of it.

#### Scenario: Recompute preserves spends

- **WHEN** a membership holding a spending line is recomputed
- **THEN** every derived column is rewritten, the spending line is unchanged, and `credits` equals the sum of the membership's ledger lines

#### Scenario: Recompute rewrites earnings from XP

- **WHEN** a membership's lifetime XP changes and it is recomputed
- **THEN** its earning line and `credits` both reflect the new XP total

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
