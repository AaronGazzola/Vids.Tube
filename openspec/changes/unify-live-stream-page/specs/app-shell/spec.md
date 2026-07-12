## MODIFIED Requirements

### Requirement: Owner-gated navigation

The system SHALL expose owner-only navigation in the sidebar, determined by a single
`useIsOwner` decision point. The sidebar SHALL show **Account** and **Go Live** to
the owner, where Go Live links to `/live` (the unified stream-management page). No
`/go-live` or `/control` entries SHALL be shown, and non-owners SHALL NOT see the Go
Live entry.

#### Scenario: Owner sees Go Live entry

- **WHEN** the owner is authenticated
- **THEN** the sidebar shows Account and Go Live, with Go Live linking to `/live`

#### Scenario: Non-owner does not see Go Live entry

- **WHEN** a visitor is not the owner
- **THEN** no Go Live navigation entry is shown
