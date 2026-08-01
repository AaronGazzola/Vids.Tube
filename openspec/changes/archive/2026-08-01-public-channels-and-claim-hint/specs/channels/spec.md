# channels Specification (delta)

## MODIFIED Requirements

### Requirement: Publishing and public channel viewing gated to the platform owner

The system SHALL treat the owner of the earliest-created channel as the platform owner. Only the platform owner SHALL be able to publish live/VOD content. Channel **viewing** SHALL be public for every channel: any visitor, anonymous or signed-in, SHALL be able to view any account (owned, non-tombstone) channel's normal channel/profile page and any unclaimed channel's stats-only profile. A merged (tombstone) channel SHALL redirect to its survivor. Publishing and branding-upload affordances SHALL render only for the channel's own owner.

#### Scenario: Non-owner cannot access publishing

- **WHEN** a signed-in user who is not the platform owner navigates to the studio/publishing area
- **THEN** the system redirects them away and exposes no publishing controls

#### Scenario: Owner channel page is public

- **WHEN** any visitor opens the platform owner's channel page
- **THEN** the page renders publicly

#### Scenario: Any account channel is publicly viewable

- **WHEN** any visitor opens any owned, non-tombstone channel page
- **THEN** the channel's normal profile/channel page renders regardless of who owns it

#### Scenario: Unclaimed channel is public

- **WHEN** any visitor opens an unclaimed channel's page
- **THEN** the stats-only profile renders with a claim call to action

#### Scenario: Merged channel redirects

- **WHEN** a visitor opens a channel whose `merged_into_channel_id` is set
- **THEN** they are redirected to the surviving channel

#### Scenario: Publishing controls are owner-only

- **WHEN** a visitor who does not own the channel views it
- **THEN** no publishing or branding-upload affordances render
