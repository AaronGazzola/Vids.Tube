# app-shell Specification

## Purpose
TBD - created by archiving change add-v1-ui-skeleton. Update Purpose after archive.
## Requirements
### Requirement: shadcn/ui component usage

All UI in this change SHALL be composed from shadcn/ui components wherever a
suitable primitive exists; custom components SHALL be thin compositions of
shadcn primitives rather than bespoke markup.

#### Scenario: A new UI surface needs a common control

- **WHEN** a page needs a button, input, dialog, dropdown, avatar, tabs, badge,
  tooltip, or similar
- **THEN** it uses the corresponding shadcn/ui component rather than a hand-rolled
  element

### Requirement: Public top navigation

The system SHALL render a top navigation bar on public pages containing the
vids.tube logo (linking to `/`), a theme toggle, a credits indicator, and an
account control.

#### Scenario: Authenticated visitor

- **WHEN** an authenticated user views any public page
- **THEN** the nav shows the credits indicator and an account menu with links to
  Account and Sign out

#### Scenario: Anonymous visitor

- **WHEN** an anonymous visitor views any public page
- **THEN** the nav shows Log in and Sign up actions instead of the account menu

### Requirement: Light/dark theme toggle

The system SHALL provide a light/dark theme toggle whose selection persists
across reloads and applies before first paint without a flash of the wrong theme.

#### Scenario: Toggling theme

- **WHEN** a user activates the theme toggle
- **THEN** the interface switches between light and dark immediately and the
  choice is stored

#### Scenario: Returning with a stored preference

- **WHEN** a user reloads a page after choosing a theme
- **THEN** the stored theme is applied during initial render with no flash of the
  opposite theme

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

### Requirement: Responsive shell

The system SHALL present a usable navigation on small screens.

#### Scenario: Narrow viewport

- **WHEN** the viewport is narrow (mobile)
- **THEN** the navigation collapses into a menu (e.g. a sheet) that exposes the
  same destinations

