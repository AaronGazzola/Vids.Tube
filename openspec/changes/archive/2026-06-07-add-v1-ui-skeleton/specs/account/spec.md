## ADDED Requirements

### Requirement: Account overview

The system SHALL provide an account page at `/account` showing the user's display
name, an initials/generated avatar, email, and a credit summary.

#### Scenario: Viewing the account page

- **WHEN** an authenticated user opens `/account`
- **THEN** the page shows their display name, an initials-based avatar, their
  email, and a credit summary linking to `/credits`

#### Scenario: Anonymous access to account

- **WHEN** an anonymous visitor opens `/account`
- **THEN** they are directed to log in

### Requirement: Profile and credential editing (stubbed)

The system SHALL present forms to edit display name, email, and password,
rendered with shadcn components; submission is stubbed for now.

#### Scenario: Editing profile fields

- **WHEN** a user edits the display name, email, or password form and submits
- **THEN** the UI acknowledges the action (stubbed) without requiring a backend

### Requirement: Delete account

The system SHALL provide a delete-account action guarded by an explicit
confirmation dialog.

#### Scenario: Confirming deletion

- **WHEN** a user activates delete account
- **THEN** a confirmation dialog requires explicit confirmation before the
  (stubbed) deletion proceeds

#### Scenario: Cancelling deletion

- **WHEN** a user dismisses the confirmation dialog
- **THEN** no deletion is attempted
