## MODIFIED Requirements

### Requirement: Simulated interactivity requests and Activity panels

The demo SHALL simulate the chat-interactivity request flows end to end: the
generator seeds one suggested !tts request, two suggested !ask requests, and
one clip marker immediately and continues producing them intermittently, each
linked to its visible `!command` message (plus a VidsBot ack row) in the demo
chat. Requests SHALL be handled inline in the demo chat exactly as in the
real Activity tab: suggested TTS messages render as violet cards with
Approve/Dismiss; suggested asks as sky cards with Answer / Question only /
Dismiss; clip messages with emerald accenting and their timestamp; handled
requests relax to normal styling with a color-matched status chip. There
SHALL be no separate demo request panels. The demo wrap-up button SHALL sit
in the bottom toolbar (where End stream sits outside demo) with the same
confirmation dialog, posting the MVP (top demo scorer), an achievement
summary, and a thanks message as VidsBot rows exactly once. Approving a TTS
or ask request SHALL still play it on the stage.

#### Scenario: Inline demo TTS approval

- **WHEN** the owner approves a suggested TTS card in the demo chat
- **THEN** the card relaxes to a violet status chip and the TTS plays on the
  stage

#### Scenario: Inline demo ask choices

- **WHEN** the owner clicks Answer (or Question only) on a demo ask card
- **THEN** the stage shows the exchange with (or without) the answer and the
  card shows its status chip

#### Scenario: Demo wrap-up from the toolbar

- **WHEN** the owner confirms the demo Wrap up button in the toolbar
- **THEN** three VidsBot messages (MVP naming the top scorer, summary,
  thanks) appear in the demo chat and the button becomes a disabled
  "Wrap-up sent" state

#### Scenario: VidsBot identity in demo chat

- **WHEN** a VidsBot row (ack or wrap-up message) appears in the demo chat
- **THEN** it renders with the bot avatar, the name "VidsBot", and a BOT
  badge, with no moderation menu and no score badge

### Requirement: Simulated activity

While demo is on, the system SHALL render the Activity tab — header (goal progress and
competition), mod bot actions, and live chat with inline request handling — from a
client-side generator using the same presentational components as the live Activity
tab. Simulated messages SHALL arrive over time with a subset scored, a few
featured/highlighted, and the leaderboard and goal counts updating, using the
production standings and goal math. The collapsed competition section SHALL show only
the top-3 badges and expand chevron; its "Competition" title SHALL appear only in the
expanded state. The demo SHALL simulate the overlays' outputs, not the AI's decision
quality.

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
