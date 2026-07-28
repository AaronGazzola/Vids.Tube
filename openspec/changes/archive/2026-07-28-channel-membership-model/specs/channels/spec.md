# channels Specification (delta)

## MODIFIED Requirements

### Requirement: Channel record

The system SHALL store channels as records with a unique slug, a name, and a description, modeled to support many channels even though v1 has one. A channel SHALL be exactly one of: **claimed** (`owner_user_id` set), **unclaimed** (`owner_user_id` null, `youtube_channel_id` set), or **merged** (`merged_into_channel_id` set). `owner_user_id` SHALL be nullable; `youtube_channel_id` SHALL be a nullable text column unique across channels; `merged_into_channel_id` SHALL be a nullable self-reference to `channels.id`. A check constraint SHALL require at least one of the three identity columns to be non-null.

#### Scenario: Channel has a unique slug

- **WHEN** a channel is created with a slug that already exists
- **THEN** the system rejects the creation because slugs MUST be unique

#### Scenario: Unclaimed channel carries only a YouTube identity

- **WHEN** a channel row is inserted with a null `owner_user_id` and a `youtube_channel_id`
- **THEN** the insert succeeds and the row reads as an unclaimed channel

#### Scenario: YouTube identity is unique

- **WHEN** a channel row is inserted with a `youtube_channel_id` already held by another channel
- **THEN** the database rejects it via the unique constraint

#### Scenario: Identity-less channel is rejected

- **WHEN** a channel row is inserted with `owner_user_id`, `youtube_channel_id`, and `merged_into_channel_id` all null
- **THEN** the database rejects it via the check constraint

## ADDED Requirements

### Requirement: Merged channels redirect to their survivor

A merged channel SHALL keep its handle (reserving it) and its page route SHALL redirect to the surviving channel's page. Channel resolution by slug SHALL follow `merged_into_channel_id` before rendering.

#### Scenario: Visiting a merged channel's URL

- **WHEN** a visitor opens the page for a handle whose channel has `merged_into_channel_id` set
- **THEN** the visitor is redirected to the surviving channel's page

### Requirement: Ownerless channels are read-only to clients

Existing owner-scoped mutation policies SHALL continue to apply unchanged: because unclaimed and merged channels have no owner, no client role can update or delete them; they are created and modified exclusively via the service role.

#### Scenario: Client cannot mutate an unclaimed channel

- **WHEN** an authenticated user attempts to update or delete an unclaimed channel
- **THEN** row-level security rejects the operation
