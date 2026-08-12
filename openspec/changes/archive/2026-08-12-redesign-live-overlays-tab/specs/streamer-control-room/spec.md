## MODIFIED Requirements

### Requirement: Control room is the single stream-operations hub

The system SHALL fold stream operations into the unified `/live` page rather than a
separate `/control` route. The `/live` page SHALL carry four tabs — Settings, Preview,
Overlays and Activity. The Settings tab SHALL provide stream configuration (connection,
YouTube URL, goals, overlay URLs, mod bot switches); the Preview tab SHALL provide the private
encoder preview, the transcript panel and the mobile layout toggle, and nothing else; the
Overlays tab SHALL provide overlay composition; and the Activity tab SHALL provide the
operating panels (live chat with moderation, the leaderboard/competition, and the mod bot
actions). The `/control` and `/go-live` routes SHALL be removed and their functionality SHALL
live in `/live`.

#### Scenario: Operations available in the unified page

- **WHEN** the owner opens `/live`
- **THEN** the Settings tab exposes configuration, the Overlays tab exposes overlay
  composition, and the Activity tab exposes chat, moderation, and the leaderboard, without
  visiting `/control` or `/go-live`

#### Scenario: Preview tab carries only the preview

- **WHEN** the owner opens the Preview tab
- **THEN** the private preview player, the transcript panel and the mobile layout toggle are
  shown, and no overlay stage, overlay editor or "Edit overlays" control appears

#### Scenario: Old routes removed

- **WHEN** the owner navigates to `/control` or `/go-live`
- **THEN** those routes no longer exist and the sidebar lists only Account and Go Live
  (→ `/live`)

### Requirement: Overlay preview bound to live/test data

The Overlays tab SHALL render the same overlay components used on the public OBS overlays
(highlighted message, goal bars, avatar bubbles), bound to the current stream's real data —
not a separate mock simulation. Overlay positions and sizes SHALL be adjustable while resize
and reposition mode is on, with a Reset to defaults.

#### Scenario: Preview reflects real stream data

- **WHEN** a highlight is promoted and viewers are scored for the current stream
- **THEN** the Overlays tab shows that promoted highlight, the avatar bubbles with their
  ranks, and the goal bars — matching what the public overlays render

#### Scenario: Preview empty state

- **WHEN** there is no current stream or no data yet
- **THEN** each overlay renders in its real empty state rather than showing a hint or
  substituting values, and the Demo switch remains available to populate the stage
