## MODIFIED Requirements

### Requirement: Control room is the single stream-operations hub

The system SHALL fold stream operations into the unified `/live` page rather than a
separate `/control` route. The `/live` page's Settings tab SHALL provide stream
configuration (connection, YouTube URL, goals, overlay URLs, mod bot switches) and its
Activity tab SHALL provide the operating panels (live chat with moderation, the
leaderboard/competition, and the mod bot actions). The `/control` and `/go-live`
routes SHALL be removed and their functionality SHALL live in `/live`.

#### Scenario: Operations available in the unified page

- **WHEN** the owner opens `/live`
- **THEN** the Settings tab exposes configuration and the Activity tab exposes chat,
  moderation, and the leaderboard, without visiting `/control` or `/go-live`

#### Scenario: Old routes removed

- **WHEN** the owner navigates to `/control` or `/go-live`
- **THEN** those routes no longer exist and the sidebar lists only Account and Go Live
  (→ `/live`)
