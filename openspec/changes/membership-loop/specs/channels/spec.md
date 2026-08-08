## ADDED Requirements

### Requirement: Channels can be marked as software

The system SHALL store an `is_software` boolean on `channels`, defaulting to false, set only by the service role. The marker SHALL be explicit per channel and SHALL NEVER be inferred from a channel's name or handle, because a real viewer's display name may contain the word "bot".

#### Scenario: The marker is explicit

- **WHEN** a channel whose display name contains "bot" belongs to a real viewer
- **THEN** that channel is not marked as software and is treated as a member

#### Scenario: Clients cannot set the marker

- **WHEN** a client attempts to set `is_software`
- **THEN** the write is denied by row-level security

### Requirement: A channel that has never published shows no videos section

A channel page SHALL omit the videos section entirely when the channel has no published videos, rather than showing the section with an empty state. The channel's own owner SHALL continue to see the section whether or not it is empty, so it stays clear where their uploads will appear.

This matters now that a chatter's channel page is a destination: a greeted chatter arriving at their own profile should not be shown an empty shelf for a feature they cannot use.

#### Scenario: A chatter's page has no videos section

- **WHEN** a visitor opens the page of a channel that has published nothing
- **THEN** no videos heading and no empty-state message render

#### Scenario: The owner still sees where uploads land

- **WHEN** a channel's own owner opens their page and has published nothing
- **THEN** the videos section renders with its empty state

#### Scenario: A published channel is unaffected

- **WHEN** a visitor opens a channel that has published videos
- **THEN** the videos section renders as before
