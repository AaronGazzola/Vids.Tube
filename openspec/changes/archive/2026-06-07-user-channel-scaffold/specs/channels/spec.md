## ADDED Requirements

### Requirement: One channel per user

The system SHALL allow each user to own at most one channel. The data model SHALL enforce this with a uniqueness constraint on the channel's `owner_user_id`.

#### Scenario: User creates their first channel

- **WHEN** an authenticated user with no existing channel creates a channel
- **THEN** the channel is created with `owner_user_id` set to that user

#### Scenario: User cannot own a second channel

- **WHEN** an authenticated user who already owns a channel attempts to create another
- **THEN** the system rejects the creation and the user still owns exactly one channel

### Requirement: Channel handle

A channel SHALL carry a unique, case-insensitive `@handle`. The handle SHALL match the format `^[a-z0-9_]{3,30}$`, SHALL be stored normalized to lowercase, and SHALL be unique across all channels regardless of case. The channel's route `slug` SHALL equal its handle.

#### Scenario: Handle is normalized and stored

- **WHEN** a user claims a handle containing uppercase letters
- **THEN** the stored handle is the lowercased form and the channel `slug` equals that handle

#### Scenario: Handle uniqueness is case-insensitive

- **WHEN** a user attempts to claim a handle that differs from an existing handle only by letter case
- **THEN** the system rejects it as already taken

#### Scenario: Handle format is enforced

- **WHEN** a user submits a handle shorter than 3 characters, longer than 30, or containing characters outside `a-z`, `0-9`, `_`
- **THEN** the system rejects it with a validation message and no channel field is changed

#### Scenario: Reserved handle is rejected

- **WHEN** a user submits a handle that matches a reserved word (e.g. `admin`, `studio`, `account`, `onboarding`)
- **THEN** the system rejects it with a message that the handle is unavailable

### Requirement: Publishing and public channel viewing gated to the platform owner

The system SHALL treat the owner of the earliest-created channel as the platform owner. Only the platform owner SHALL be able to publish live/VOD content. A channel page SHALL be publicly viewable only when it is the platform owner's channel; any other user's channel page SHALL be viewable only by that channel's own owner and SHALL otherwise return not-found.

#### Scenario: Non-owner cannot access publishing

- **WHEN** a signed-in user who is not the platform owner navigates to the studio/publishing area
- **THEN** the system redirects them away and exposes no publishing controls

#### Scenario: Owner channel page is public

- **WHEN** any visitor opens the platform owner's channel page
- **THEN** the page renders publicly

#### Scenario: Non-owner channel page is private

- **WHEN** a visitor who is not the channel's owner opens a non-owner channel page
- **THEN** the system returns not-found

#### Scenario: A user can view their own channel page

- **WHEN** a signed-in non-owner user opens their own channel page
- **THEN** the page renders for them

### Requirement: Channel rows remain readable for identity resolution

The system SHALL keep channel rows readable so that a user's handle, name, and avatar can be resolved from their `owner_user_id`. Read access to channel rows SHALL NOT be restricted by the publishing/page-viewing gate.

#### Scenario: Resolve author identity from user id

- **WHEN** the system looks up the channel whose `owner_user_id` equals a given user id
- **THEN** it can read that channel's handle, name, and avatar regardless of whether that channel is publicly browsable
