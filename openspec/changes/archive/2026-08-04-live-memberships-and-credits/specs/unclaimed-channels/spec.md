## MODIFIED Requirements

### Requirement: Unclaimed channel per archived chatter

The system SHALL provide a service-role job that creates exactly one unclaimed channel (`owner_user_id` null, `youtube_channel_id` set) for every `chatter_stats.author_channel_id` that has no existing channel holding that `youtube_channel_id`. The job SHALL be idempotent and re-runnable, SHALL set the channel `name` from the chatter's display name (falling back to a generic label), and SHALL abort with a clear message if the channel/membership model (AZ-169) has not been applied. The job SHALL be a backfill for chatters who appear only in archived history; a chatter who speaks during a live broadcast SHALL be onboarded by the worker instead, so the job SHALL find nothing to do for anyone who has already appeared live.

#### Scenario: First run materializes every chatter

- **WHEN** the job runs against a roster of archived chatters with no unclaimed channels yet
- **THEN** one unclaimed channel is created per chatter, each with a unique handle and its `youtube_channel_id` set to the chatter's `author_channel_id`

#### Scenario: Re-run creates no duplicates

- **WHEN** the job runs a second time
- **THEN** no new channel rows are inserted (the existing `youtube_channel_id` rows are detected and skipped)

#### Scenario: Aborts without the identity model

- **WHEN** the job runs before AZ-169's `channels.youtube_channel_id`, `memberships`, or `recompute_membership` exist
- **THEN** the job exits with an explanatory error and creates nothing

#### Scenario: Chatters onboarded live are skipped

- **WHEN** the job runs after a broadcast in which previously unknown chatters spoke
- **THEN** those chatters already hold channels created by the worker and the job creates nothing for them

### Requirement: Generated unique handle

Each unclaimed channel SHALL receive a handle matching `^[a-z0-9_]{3,30}$`, derived by normalizing the chatter's YouTube handle (or display name as fallback) to lowercase with disallowed characters replaced, padded to at least 3 and truncated to at most 30 characters. The handle SHALL NOT be a reserved word and SHALL be made unique against existing handles (case-insensitive) by appending a numeric suffix, truncating the base as needed. The routine that generates handles SHALL be shared with the live onboarding path so both produce identical results for the same input.

#### Scenario: Colliding handles get a suffix

- **WHEN** two chatters normalize to the same base handle
- **THEN** the first keeps the base handle and the second receives a suffixed variant (e.g. `_2`) that stays within 30 characters and is unique

#### Scenario: Reserved handle avoided

- **WHEN** a chatter's normalized handle matches a reserved route word
- **THEN** the job selects an alternative handle rather than the reserved word

#### Scenario: The live path and the job agree

- **WHEN** the same display name is put through the live onboarding path and through the job
- **THEN** both derive the same base handle
