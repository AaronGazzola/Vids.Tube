# channels Specification (delta)

## MODIFIED Requirements

### Requirement: Publishing and public channel viewing gated to the platform owner

The system SHALL treat the owner of the earliest-created channel as the platform owner. Only the platform owner SHALL be able to publish live/VOD content. A channel page SHALL be publicly viewable when it is the platform owner's channel OR when it is an **unclaimed** channel (`owner_user_id` null and not a tombstone), the latter rendering a stats-only profile. Any other user's claimed channel page SHALL be viewable only by that channel's own owner and SHALL otherwise return not-found.

#### Scenario: Non-owner cannot access publishing

- **WHEN** a signed-in user who is not the platform owner navigates to the studio/publishing area
- **THEN** the system redirects them away and exposes no publishing controls

#### Scenario: Owner channel page is public

- **WHEN** any visitor opens the platform owner's channel page
- **THEN** the page renders publicly

#### Scenario: Unclaimed channel page is public

- **WHEN** any visitor opens an unclaimed channel's page
- **THEN** the stats-only profile renders publicly with a claim call to action

#### Scenario: Non-owner claimed channel page is private

- **WHEN** a visitor who is not the channel's owner opens another user's claimed channel page
- **THEN** the system returns not-found

#### Scenario: A user can view their own channel page

- **WHEN** a signed-in non-owner user opens their own channel page
- **THEN** the page renders for them
