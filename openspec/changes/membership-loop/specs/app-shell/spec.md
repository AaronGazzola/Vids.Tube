## MODIFIED Requirements

### Requirement: Public top navigation

The system SHALL render a top navigation bar on public pages containing the
vids.tube logo (linking to `/`), a theme toggle, and an account control.

The credits indicator this requirement previously described is removed: it was
never built, and it belonged to an earlier design in which credits were a
site-wide wallet. Credits are earned per community, so a single figure in the
navigation would have no community to belong to.

#### Scenario: Authenticated visitor

- **WHEN** an authenticated user views any public page
- **THEN** the nav shows an account menu with links to Account and Sign out

#### Scenario: Anonymous visitor

- **WHEN** an anonymous visitor views any public page
- **THEN** the nav shows Log in and Sign up actions instead of the account menu
