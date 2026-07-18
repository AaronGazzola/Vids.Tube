# streamer-control-room Specification

## Purpose
TBD - created by archiving change add-score-reasoning-visibility. Update Purpose after archive.
## Requirements
### Requirement: Leaderboard entries expose the AI's scoring reasoning

The control room leaderboard SHALL let the owner reveal, per viewer, the AI's reasoning
behind that viewer's score: the recent per-message dimension breakdown (engagement,
humour, contribution), the points each message earned, and any feature reasons. The
reasoning SHALL load on demand (only when the owner expands an entry), so it does not add
queries for collapsed entries.

#### Scenario: Owner reveals why a viewer is ranked where they are

- **WHEN** the owner expands a viewer on the control-room leaderboard
- **THEN** the viewer's recent messages are shown with their engagement/humour/contribution
  scores and the points each earned, plus any reason the AI gave for featuring them

#### Scenario: Reasoning is not fetched until requested

- **WHEN** the leaderboard renders with all entries collapsed
- **THEN** no per-viewer reasoning query is issued until the owner expands an entry

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

### Requirement: Owner-only control room

The system SHALL provide an owner-only `/studio/control` route, guarded so non-owners are
redirected away, laid out as a dense window the owner can pop out beside OBS.

#### Scenario: Non-owner is redirected

- **WHEN** a signed-out or non-owner user opens `/studio/control`
- **THEN** they are redirected away and do not see the control room

#### Scenario: Owner sees the operating view

- **WHEN** the owner opens `/studio/control`
- **THEN** the page renders immediately with a live/offline badge and panels for chat,
  the read-this queue, and a goal/score glance

### Requirement: AI read-this queue

The control room SHALL show the AI-featured messages for the current stream, newest
first, with the message text, the AI's reason, and category tags, so the owner knows
which messages to read out. The owner SHALL be able to dismiss an item from the queue.

#### Scenario: Featured messages surface for the owner

- **WHEN** the scoring bot features a message during the stream
- **THEN** it appears in the read-this queue with its text and the AI's reason

#### Scenario: Dismissing a read item

- **WHEN** the owner marks a read-this item as read
- **THEN** it is removed from the owner's queue view

### Requirement: Live chat with moderation slots

The control room SHALL show the live chat (realtime) with author identity, and SHALL
present per-message and per-author moderation controls. Until the moderation engine ships,
these controls SHALL be present but inert (disabled), so enabling them later is additive.

#### Scenario: Chat streams in realtime

- **WHEN** a viewer posts a chat message during the stream
- **THEN** it appears in the control room's chat panel without a reload

#### Scenario: Moderation controls are visible but inert

- **WHEN** the owner views a chat message or an author in the control room
- **THEN** a Hide control (per message) and a Ban control (per author) are shown disabled,
  indicating moderation is not yet enabled

