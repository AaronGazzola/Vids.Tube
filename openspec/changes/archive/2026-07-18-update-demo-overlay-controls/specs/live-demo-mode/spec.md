## MODIFIED Requirements

### Requirement: Overlay-feed parity on the demo stage

The demo stage SHALL render the complete OBS overlay feed — highlighted
message, TTS card, and !ask exchange — as one stacked column inside the
highlight box, using the same presentational components as the real overlay
page, so the demo preview is visually identical to the OBS browser source.
The stage highlight SHALL show only promoted messages (not every
generator-featured suggestion). In the overlay control panel, the Highlight,
TTS card, and !ask exchange rows SHALL each offer: a visibility toggle
(persisted with the demo layout), a **Play** button that displays one demo
value on the stage immediately, and a **persist** checkbox that keeps the
played overlay on screen instead of auto-hiding when its animation, audio, or
hold timer ends.

#### Scenario: Play buttons drive the stage

- **WHEN** the owner clicks Play under TTS card (or !ask exchange, or
  Highlight)
- **THEN** the stage immediately shows a demo TTS card playing the sample
  clip (or a full ask exchange, or a promoted highlight) without touching the
  Activity tab

#### Scenario: Persist freezes the overlay

- **WHEN** persist is checked for an overlay and it is played
- **THEN** the overlay stays visible after its clip/hold/animation would have
  ended, until persist is unchecked or the element is replaced

#### Scenario: Highlight is owner-driven

- **WHEN** the generator features a simulated message and the owner does
  nothing
- **THEN** it appears as a suggestion in the demo Activity chat but the stage
  highlight stays empty until a message is promoted or Play is clicked

#### Scenario: Toggles hide the new overlays

- **WHEN** the owner switches "TTS card" or "!ask exchange" off in the
  overlay panel
- **THEN** that element no longer renders on the stage and the preference
  persists with the saved demo layout

### Requirement: Simulated interactivity requests and Activity panels

The demo SHALL simulate the chat-interactivity request flows end to end: the
generator seeds one suggested !tts request, two suggested !ask requests, and
one clip marker immediately and continues producing them intermittently, each
accompanied by the visible `!command` message and a VidsBot ack row in the
demo chat. The demo Activity view SHALL group the owner controls in a single
collapsible **"VidsBot actions"** component with one tab per flow — TTS
requests (approve/dismiss), Ask requests (approve with a per-row "Include AI
answer" checkbox, dismiss), Clip markers, and Wrap up (confirmation dialog →
MVP naming the top demo scorer, an achievement summary, and a thanks message
as VidsBot rows, exactly once). Approving a TTS or ask request SHALL still
play it on the stage.

#### Scenario: Tabbed VidsBot actions

- **WHEN** the owner opens the VidsBot actions component in the demo Activity
  tab
- **THEN** TTS requests, Ask requests, Clip markers, and Wrap up are separate
  tabs inside the one collapsible panel

#### Scenario: Approving a TTS request

- **WHEN** the owner approves a suggested TTS request in the TTS tab
- **THEN** its status changes, it plays on the stage, and it is marked played
  when the clip ends

#### Scenario: Wrap-up fires once

- **WHEN** the owner confirms the demo Wrap up dialog
- **THEN** three VidsBot messages (MVP naming the top scorer, summary,
  thanks) appear in the demo chat and the button becomes a disabled
  "Wrap-up sent" state

#### Scenario: VidsBot identity in demo chat

- **WHEN** a VidsBot row (ack or wrap-up message) appears in the demo chat
- **THEN** it renders with the bot avatar, the name "VidsBot", and a BOT
  badge, with no moderation menu and no score badge

### Requirement: Simulated activity

While demo is on, the system SHALL render the Activity tab — header (goal progress and
competition), mod bot actions, VidsBot actions, and live chat — from a client-side
generator using the same presentational components as the live Activity tab. Simulated
messages SHALL arrive over time with a subset scored, a few featured/highlighted, and
the leaderboard and goal counts updating, using the production standings and goal math.
The collapsed competition section SHALL show only the top-3 badges and expand chevron;
its "Competition" title SHALL appear only in the expanded state. The demo SHALL
simulate the overlays' outputs, not the AI's decision quality.

#### Scenario: Simulated chat populates activity

- **WHEN** demo is on and the Activity tab is open
- **THEN** simulated messages arrive over time and appear in the chat with the same
  affordances as live

#### Scenario: Scores and features update

- **WHEN** the generator scores and features simulated messages
- **THEN** the competition/leaderboard and featured highlights update via the production
  standings and goal math

#### Scenario: Collapsed competition is badges-only

- **WHEN** the competition section is collapsed
- **THEN** it shows the top-3 badges and the chevron without the "Competition"
  title, which appears once expanded

#### Scenario: Scope is visuals, not AI decisions

- **WHEN** the owner uses the demo
- **THEN** it reflects how the overlays and activity look and behave, not whether the
  model would pick those messages or scores
