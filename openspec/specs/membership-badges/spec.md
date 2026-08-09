# membership-badges Specification

## Purpose
TBD - created by archiving change membership-loop. Update Purpose after archive.
## Requirements
### Requirement: Badges are defined as data, not code

The system SHALL store badge definitions in a `badges` table keyed by a stable text `key`, carrying `title`, `description`, `criteria` (the human-readable condition, shown to viewers), an icon identifier, and `created_at`. Adding a badge SHALL be the insertion of a row, never a code change.

Definitions SHALL be publicly readable and writable only by the service role.

#### Scenario: A new badge needs no migration

- **WHEN** a new badge is introduced
- **THEN** it is created by inserting a definition row, with no schema change

#### Scenario: Definitions are public and read-only to clients

- **WHEN** an anonymous client reads badge definitions
- **THEN** the rows are returned, and any insert or update from a client is denied

### Requirement: A badge is awarded to a membership

The system SHALL store awards in a `membership_badges` table joining a membership to a badge, carrying `awarded_at` and an optional `note`, unique on (membership, badge) so a badge cannot be awarded twice. Awards SHALL cascade away with their membership.

Awards SHALL be scoped to a membership rather than a channel, so a badge earned in one community never appears in another.

#### Scenario: A badge cannot be awarded twice

- **WHEN** the same badge is awarded again to the same membership
- **THEN** the database rejects the duplicate

#### Scenario: A badge belongs to one community

- **WHEN** a member holds memberships in two communities and is awarded a badge in one
- **THEN** the badge appears on that community's membership only

#### Scenario: Awards follow their membership

- **WHEN** a membership is deleted
- **THEN** its awards are deleted with it

### Requirement: The award shape does not constrain future conditions

The award record SHALL carry no condition logic of its own, so a badge may later be granted by a script, by an evaluator run after each membership recompute, or by hand, without any change to the tables. Nothing in the schema SHALL assume when or why a badge was granted.

#### Scenario: A future condition needs no schema change

- **WHEN** a badge is later awarded automatically for reaching a streak length, a level, or a highly rated message
- **THEN** the same definition and award tables carry it, with no migration

### Requirement: Day One is awarded once, to the members who were already here

The system SHALL define a badge with key `day-one`, awarded to every membership that existed in the community before this change's cutoff date, excluding channels marked as software and the removed test channels. The award SHALL be performed by an idempotent script that can be re-run without duplicating awards.

Day One SHALL state when a member arrived, not how much they participated, so it SHALL NOT be gated on message count, level or attendance.

After the cutoff, Day One SHALL never be awarded again.

#### Scenario: Existing members receive Day One

- **WHEN** the award script runs
- **THEN** every real member holding a membership before the cutoff holds the Day One badge

#### Scenario: The script is safe to re-run

- **WHEN** the award script runs a second time
- **THEN** no duplicate awards are created

#### Scenario: Software and test channels are skipped

- **WHEN** the award script runs
- **THEN** no award is created for a channel marked as software or for a removed test channel

#### Scenario: A new chatter after the cutoff does not get Day One

- **WHEN** someone chats for the first time after the cutoff
- **THEN** they become a member and do not receive Day One

### Requirement: Badges are shown wherever a member is shown

Badges SHALL render on the membership card on a channel page and beside a member's entry on a community leaderboard. Each badge SHALL expose its title and description to the viewer, so a badge is self-explanatory without a legend elsewhere.

#### Scenario: A badge explains itself

- **WHEN** a viewer inspects a badge on a membership card or a leaderboard entry
- **THEN** its title and description are available without leaving the page

