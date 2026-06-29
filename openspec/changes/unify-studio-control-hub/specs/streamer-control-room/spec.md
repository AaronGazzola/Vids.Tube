## ADDED Requirements

### Requirement: Control room is the single stream-operations hub

The control room SHALL be the one surface for configuring, operating, and demonstrating a
stream. It SHALL include a Setup section for stream configuration and an overlay Preview
section, in addition to the existing operating panels (chat, read-this queue, leaderboard,
moderation). The standalone overlay-config and overlay-demo routes SHALL be retired and
redirect to the control room.

#### Scenario: Setup is available in the control room

- **WHEN** the owner opens the control room
- **THEN** a Setup section lets them set the YouTube broadcast URL, toggle featuring, set
  and start goal targets, and copy the OBS source URLs — without visiting another page

#### Scenario: Old routes redirect to the hub

- **WHEN** the owner navigates to the former `/studio/overlay` or `/studio/demo`
- **THEN** they are redirected to `/studio/control`, and the sidebar no longer lists those
  as separate entries

### Requirement: Overlay preview bound to live/test data

The control room SHALL provide a draggable overlay Preview that renders the same overlay
components used on the public OBS overlays (highlighted message, goal bars, avatar bubbles),
bound to the current stream's real data — not a separate mock simulation. Preview layout
positions SHALL be adjustable with a Reset to defaults.

#### Scenario: Preview reflects real stream data

- **WHEN** a highlight is promoted and viewers are scored for the current stream
- **THEN** the Preview shows that promoted highlight, the avatar bubbles with their ranks,
  and the goal bars — matching what the public overlays render

#### Scenario: Preview empty state

- **WHEN** there is no current stream or no data yet
- **THEN** the Preview shows a hint to go live or run the dry-run to populate it

### Requirement: Test-mode indicator

When the control room's active stream is the dry-run/test stream, the control room SHALL
display a clearly visible banner indicating the data is simulated, so the owner never
mistakes a rehearsal for a live broadcast. Detection SHALL not require a schema change.

#### Scenario: Banner shows for the dry-run stream

- **WHEN** the active stream is the dry-run stream (its title carries the dry-run marker)
- **THEN** the control room shows a banner stating the data is simulated by the dry-run

#### Scenario: No banner for a real stream

- **WHEN** the active stream is a normal live stream
- **THEN** no test-mode banner is shown
