# live-chatter-onboarding Specification

## Purpose
TBD - created by archiving change live-memberships-and-credits. Update Purpose after archive.
## Requirements
### Requirement: An unknown chatter is onboarded on their first message

When a chat message arrives during a broadcast from a YouTube account that has no channel and no retired profile pointing at one, the worker SHALL create a channel for that account and then call `recompute_membership` for that channel and the broadcast's community, before the message reaches the scoring buffer. Onboarding SHALL happen at most once per account per broadcast.

#### Scenario: First-time chatter gets a channel and a membership

- **WHEN** an account with no existing channel sends its first message during a broadcast
- **THEN** a channel exists for that account and a membership exists for that channel in the broadcast's community

#### Scenario: A returning chatter is not onboarded again

- **WHEN** an account that already has a channel sends a message
- **THEN** no new channel is created and the existing channel is used

#### Scenario: A retired profile is not re-created

- **WHEN** an account whose channel has been retired into another channel sends a message
- **THEN** no new channel is created and the surviving channel is used

#### Scenario: Onboarding precedes scoring

- **WHEN** a first-time chatter's message is scored in the batch it arrived in
- **THEN** the membership already exists and receives that batch's XP

### Requirement: The host and bots are never onboarded as chatters

The worker SHALL NOT create a channel or a membership for a message identified as coming from the host or from a bot. Both SHALL continue to be stored in chat history and excluded from scoring.

#### Scenario: Host message does not create a chatter channel

- **WHEN** the host sends a message in their own broadcast
- **THEN** no chatter channel and no membership are created for the host's account

#### Scenario: Bot message does not create a chatter channel

- **WHEN** a bot message arrives in chat
- **THEN** no channel and no membership are created for the bot

### Requirement: Enrichment mode is a per-channel setting

The system SHALL store a `chatter_enrichment_mode` on `channels`, constrained to `full` or `deferred`, defaulting to `full`. The worker SHALL read the mode for the broadcast's community and apply it to every chatter onboarded during that broadcast.

#### Scenario: Default is full enrichment

- **WHEN** a channel is created without an explicit enrichment mode
- **THEN** its mode is `full`

#### Scenario: An invalid mode is rejected

- **WHEN** a value other than `full` or `deferred` is written to the enrichment mode
- **THEN** the database rejects it

### Requirement: Full mode fetches the real handle and avatar before creating the channel

In `full` mode the worker SHALL look up the chatter's YouTube channel to obtain their real handle and high-resolution avatar, cache the avatar, and create the channel with both. If the lookup fails or does not answer, the worker SHALL fall back to the `deferred` behaviour for that chatter rather than dropping the message or stalling the chat poll.

#### Scenario: Full enrichment on first message

- **WHEN** an unknown chatter speaks while the mode is `full` and the lookup succeeds
- **THEN** their channel carries their real handle and a cached high-resolution avatar

#### Scenario: A failed lookup does not stall ingest

- **WHEN** the YouTube lookup fails for an unknown chatter while the mode is `full`
- **THEN** the channel is created from the display name and low-resolution avatar on the message, the message is still stored and scored, and the chatter is left for the post-broadcast enrichment pass

### Requirement: Deferred mode creates a minimal channel from the message

In `deferred` mode the worker SHALL create the channel using only the display name and avatar URL already carried on the chat message, without any external lookup, and SHALL mark the channel as awaiting enrichment.

#### Scenario: Minimal creation makes no external call

- **WHEN** an unknown chatter speaks while the mode is `deferred`
- **THEN** their channel is created with a handle derived from their display name, no YouTube lookup is made, and the channel is marked as awaiting enrichment

### Requirement: A post-broadcast pass enriches channels awaiting enrichment

The system SHALL provide a pass that runs after a broadcast, batches the YouTube lookups for every channel marked as awaiting enrichment, writes the real handle and high-resolution avatar, and clears the mark. The pass SHALL leave a channel marked when its lookup fails, so a later run retries it.

#### Scenario: Deferred channels are enriched afterwards

- **WHEN** the pass runs after a broadcast that created channels in `deferred` mode
- **THEN** each of those channels carries its real handle and a cached high-resolution avatar, and is no longer marked as awaiting enrichment

#### Scenario: A failed lookup is retried later

- **WHEN** a channel's lookup fails during the pass
- **THEN** the channel remains marked as awaiting enrichment and is attempted again on the next run

### Requirement: Handles are generated identically on every path

The live onboarding path, the deferred enrichment pass, and the historical backfill job SHALL produce channel handles using one shared routine, so a handle generated on one path cannot collide with or differ in form from a handle generated on another.

#### Scenario: The same chatter yields the same handle on any path

- **WHEN** the same display name and YouTube account are onboarded live and would also be created by the backfill job
- **THEN** both paths produce the same handle

#### Scenario: A taken handle is made unique

- **WHEN** an onboarded chatter's derived handle is already in use
- **THEN** a unique variant is generated and no existing channel is altered

