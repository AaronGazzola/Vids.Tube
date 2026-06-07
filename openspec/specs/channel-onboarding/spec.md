# channel-onboarding Specification

## Purpose
TBD - created by archiving change user-channel-scaffold. Update Purpose after archive.
## Requirements
### Requirement: New users must claim a handle before using the app

The system SHALL require an authenticated user who does not yet own a channel to complete onboarding by choosing a unique `@handle`. Until onboarding is complete, the system SHALL redirect the user to the onboarding flow when they attempt to use authenticated areas of the app. This gating SHALL be implemented with react-query checks, not middleware.

#### Scenario: Authenticated user without a channel is sent to onboarding

- **WHEN** an authenticated user with no channel loads an authenticated area of the app
- **THEN** the system redirects them to the onboarding flow

#### Scenario: User with a channel is not sent to onboarding

- **WHEN** an authenticated user who already owns a channel loads the app
- **THEN** the system does not redirect them to onboarding

#### Scenario: Completed user leaving onboarding open is redirected away

- **WHEN** a user who already owns a channel navigates directly to the onboarding route
- **THEN** the system redirects them to the app

### Requirement: Handle selection with availability feedback

The onboarding flow SHALL let the user enter a handle, validate its format client-side, and indicate whether the handle is available before submission. Availability feedback SHALL be advisory; the uniqueness constraint at submission SHALL be authoritative.

#### Scenario: Available handle is indicated

- **WHEN** the user enters a well-formed handle that no channel currently uses
- **THEN** the flow indicates the handle is available

#### Scenario: Taken handle is indicated

- **WHEN** the user enters a well-formed handle that another channel already uses
- **THEN** the flow indicates the handle is taken and prevents submission

#### Scenario: Malformed handle is indicated before submission

- **WHEN** the user enters a handle that violates the format rules
- **THEN** the flow shows the format requirement and does not treat the handle as submittable

### Requirement: Channel is provisioned on onboarding completion

The system SHALL create the user's channel when they complete onboarding, setting `owner_user_id` to the current user, `handle` and `slug` to the chosen handle, and a default name derived from the handle. On success the user SHALL be routed into the app.

#### Scenario: Successful onboarding creates the channel

- **WHEN** an authenticated user without a channel submits an available, well-formed handle
- **THEN** the system creates their channel with that handle and routes them into the app

#### Scenario: Handle taken at submission time is reported

- **WHEN** the chosen handle is claimed by someone else between the availability check and submission
- **THEN** the system reports that the handle is no longer available and does not create a channel

