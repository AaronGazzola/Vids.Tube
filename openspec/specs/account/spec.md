# account Specification

## Purpose
TBD - created by archiving change add-v1-ui-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Account overview

The system SHALL provide an account page at `/account` showing the user's display
name, an initials/generated avatar, and email.

The credit summary this requirement previously described, and its link to a
`/credits` page, are removed: neither was ever built, and the page it pointed at
belonged to an earlier monetisation design. Credits are earned from participation
rather than held in an account-level wallet, so they are shown on the membership
that earned them rather than on the account.

#### Scenario: Viewing the account page

- **WHEN** an authenticated user opens `/account`
- **THEN** the page shows their display name, an initials-based avatar, and their
  email

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

