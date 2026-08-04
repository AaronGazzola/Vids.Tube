# credit-ledger Specification

## Purpose
TBD - created by archiving change live-memberships-and-credits. Update Purpose after archive.
## Requirements
### Requirement: Credit movements are recorded as ledger lines

The system SHALL store every credit movement in a `credit_entries` table carrying `id`, `membership_id` (cascading on membership delete), `amount` (bigint, signed), `kind` (text), `source_id` (text, nullable), `created_at`, and `updated_at`. A positive `amount` SHALL represent credits earned and a negative `amount` SHALL represent credits spent. A membership's credit balance SHALL be the sum of its lines and SHALL never be stored as an independently mutable number.

#### Scenario: Balance is the sum of the lines

- **WHEN** a membership holds an earning line of 164 and spending lines of -10 and -25
- **THEN** its credit balance is 129

#### Scenario: Lines follow their membership

- **WHEN** a membership row is deleted
- **THEN** all of its `credit_entries` rows are deleted by cascade

#### Scenario: Only the service role may write lines

- **WHEN** an `anon` or `authenticated` role inserts, updates or deletes a `credit_entries` row
- **THEN** the write is rejected

### Requirement: Earnings derive from lifetime XP at a single configured rate

The system SHALL provide a `credits_for_xp(xp bigint)` SQL function returning `floor(xp / 10)`, and `recompute_membership` SHALL maintain exactly one earning line per membership, of `kind` `earned`, whose `amount` is `credits_for_xp(lifetime_xp)` for that membership. The earning line SHALL be created when absent and rewritten in place when present. No other routine SHALL write an earning line.

#### Scenario: Earning line tracks XP

- **WHEN** a membership's lifetime XP is 1640 and it is recomputed
- **THEN** it holds exactly one line of kind `earned` with an amount of 164

#### Scenario: Earning line is rewritten, not duplicated

- **WHEN** a membership is recomputed twice with different XP totals between the runs
- **THEN** it still holds exactly one line of kind `earned`, carrying the amount derived from the later XP total

#### Scenario: Zero XP produces a zero earning line

- **WHEN** a membership with no scored messages is recomputed
- **THEN** it holds exactly one line of kind `earned` with an amount of 0

### Requirement: Spending lines survive a re-score

Spending lines SHALL be written only by the operation that consumes credits, SHALL carry a negative `amount`, and SHALL never be created, modified or deleted by `recompute_membership`. Rebuilding every rating in the system and recomputing every membership SHALL change only earning lines.

#### Scenario: Re-scoring does not refund a spend

- **WHEN** a membership with an earning line of 164 and a spending line of -25 is recomputed after a re-score that lowers its XP to 1000
- **THEN** the earning line becomes 100, the spending line remains -25, and the balance is 75

#### Scenario: A spend cannot be lost to a concurrent recompute

- **WHEN** a spending line is inserted and the same membership is recomputed immediately afterwards
- **THEN** the spending line is still present and is reflected in the balance

### Requirement: A spend is refused when the balance is insufficient

The system SHALL provide a `spend_credits(p_membership_id, p_amount, p_kind, p_source_id)` SQL function that writes a spending line only when the membership's current balance is greater than or equal to the requested amount, and SHALL return an indication of refusal without writing a line otherwise. The function SHALL be executable by the service role only.

#### Scenario: Spend within balance

- **WHEN** a membership with a balance of 129 spends 25
- **THEN** a line of -25 is written and the balance becomes 104

#### Scenario: Spend beyond balance

- **WHEN** a membership with a balance of 10 attempts to spend 25
- **THEN** no line is written, the balance stays 10, and the caller is told the spend was refused

### Requirement: The cached balance on the membership matches the ledger

`memberships.credits` SHALL be maintained as a cached copy of the ledger sum, rewritten by the same routines that write earning and spending lines, so existing readers need not sum the ledger. The ledger SHALL remain the source of truth.

#### Scenario: Cache follows an earning change

- **WHEN** a membership is recomputed and its earning line changes
- **THEN** `memberships.credits` equals the new sum of that membership's lines

#### Scenario: Cache follows a spend

- **WHEN** a spend is recorded for a membership
- **THEN** `memberships.credits` equals the new sum of that membership's lines

#### Scenario: Cache is verifiable

- **WHEN** every membership's cached balance is compared against the sum of its ledger lines
- **THEN** no membership differs

### Requirement: Merging identities carries spends and re-derives earnings

When two profiles merge, the system SHALL re-point the losing membership's spending lines onto the surviving membership and SHALL NOT carry its earning line across. The surviving membership's earning line SHALL be re-derived from its pooled XP by the recompute that follows the merge.

#### Scenario: Spends move to the survivor

- **WHEN** a membership holding a spending line of -25 is merged into another membership
- **THEN** the surviving membership holds that -25 line

#### Scenario: Earnings are not double counted

- **WHEN** two memberships each holding an earning line are merged
- **THEN** the surviving membership holds exactly one earning line, derived from the pooled XP rather than from the sum of the two previous earning lines

