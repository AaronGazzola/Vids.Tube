## MODIFIED Requirements

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
