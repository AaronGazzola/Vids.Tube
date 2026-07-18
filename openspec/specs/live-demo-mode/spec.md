# live-demo-mode Specification

## Purpose

Let the owner rehearse a broadcast from the unified `/live` page: a Demo switch swaps
the Preview and Activity tabs to a simulated stream (VOD-frame slideshow, generated
chat/scoring/moderation) with the real overlay components layered over it in a
repositionable, persisted layout — without going live, running the worker, or writing
any real stream data. Supersedes the deleted `/studio/demo` page (`overlay-demo` /
`overlay-demo-sim`).

## Requirements

### Requirement: Demo switch on the /live page

The system SHALL provide a Demo switch — a shadcn/ui `Switch` — pinned to the far right
of the `/live` tab bar, off by default. Turning it on SHALL put the page into a
self-contained demo workflow in which the Preview and Activity tabs render a simulated
stream; turning it off SHALL restore the real active stream. The demo SHALL make no
writes to the stream, chat, scoring, featured, or moderation tables and SHALL NOT engage
the worker or YouTube. The Settings tab SHALL continue to edit and save the real active
stream in both modes, and the enabled state SHALL be ephemeral (off on load).

#### Scenario: Toggle demo on

- **WHEN** the owner turns the Demo switch on
- **THEN** the Preview and Activity tabs switch to the simulated stream and no writes are
  made to real stream/chat/scoring data

#### Scenario: Toggle demo off restores the real stream

- **WHEN** the owner turns the Demo switch off
- **THEN** the real active stream returns with any Settings the owner saved intact,
  unchanged by the demo

#### Scenario: Settings still edits the real stream during demo

- **WHEN** the owner edits and saves Settings while demo is on
- **THEN** the save targets the real active stream, and those changes are present when
  demo is turned off

### Requirement: Per-tab pop-out

The system SHALL show the pop-out icon in the tab bar only when the active tab is Preview
or Activity, and it SHALL pop out that tab's content — the preview player for Preview, the
Activity panel for Activity. The pop-out icon SHALL NOT appear on the Settings tab, and
pop-out SHALL be unavailable while demo is on.

#### Scenario: Pop-out follows the active tab

- **WHEN** the owner is on the Preview tab and clicks pop-out
- **THEN** a window opens rendering the preview player; on the Activity tab it renders the
  Activity panel

#### Scenario: No pop-out on Settings

- **WHEN** the owner is on the Settings tab
- **THEN** no pop-out icon is shown

### Requirement: Demo preview slideshow

While demo is on, the system SHALL replace the Preview player with a slideshow of frames
sourced from the channel's published (`status='ready'`) VODs, using each video's
`preview_paths` (falling back to its `thumbnail_path`). The slideshow SHALL autoplay
through the frames, provide prev/next controls to step manually, hold a frame when the
owner selects one (pausing autoplay), and resume via a play/pause control. When the
channel has no ready VOD frames the system SHALL show an empty-state message and still
render the overlays over a plain background.

#### Scenario: Autoplay cycles frames

- **WHEN** demo is on and frames are available
- **THEN** the preview cycles through the channel's VOD frames on a timer

#### Scenario: Manual step holds a frame

- **WHEN** the owner steps with prev/next or selects a frame
- **THEN** autoplay pauses and that frame is held until play is resumed

#### Scenario: No VOD frames

- **WHEN** the channel has no ready VOD frames
- **THEN** the preview shows an empty-state message and the overlays still render over a
  plain background

### Requirement: Demo overlay stage

While demo is on, the system SHALL render all overlay surfaces over the preview: the
three goal bars (subs, likes, viewers), the competition, the highlighted-message, and the
avatar bubbles. Goals and competition SHALL be independently draggable and
resizable/scalable boxes; the highlighted-message and avatar bubbles SHALL play as
full-stage animations as they do live and SHALL NOT be repositionable. Each overlay SHALL
have a show/hide toggle. The stage SHALL provide a goal-progress toggle (in-progress vs
reached), a background toggle (slideshow, gradient, or black), and a reset-layout control.

#### Scenario: Reposition and resize a box overlay

- **WHEN** the owner drags a goal bar or the competition and drags its resize handle
- **THEN** that overlay moves and scales independently of the others

#### Scenario: Toggle an overlay's visibility

- **WHEN** the owner toggles an overlay's show/hide control
- **THEN** that overlay appears or disappears from the stage without affecting the others

#### Scenario: Toggle goal progress

- **WHEN** the owner toggles goal progress to reached
- **THEN** the goal bars render their full/reached state, and back to in-progress when
  toggled off

#### Scenario: Reset layout

- **WHEN** the owner clicks reset layout
- **THEN** the box overlays return to their default positions and scales

### Requirement: Persisted demo layout

The system SHALL persist, per channel, the demo overlay layout — each box overlay's
position and scale, every overlay's visibility, the goal-progress state, and the
background choice — and SHALL restore it the next time demo is enabled. Persistence SHALL
be owner-scoped.

#### Scenario: Layout persists across sessions

- **WHEN** the owner arranges the overlays, toggles visibility, then reloads and
  re-enables demo
- **THEN** the saved positions, scales, visibility, goal-progress, and background are
  restored

### Requirement: Simulated activity

While demo is on, the system SHALL render the Activity tab — header (goal progress and
competition), mod bot actions, and live chat — from a client-side generator using the
same presentational components as the live Activity tab. Simulated messages SHALL arrive
over time with a subset scored, a few featured/highlighted, and the leaderboard and goal
counts updating, using the production standings and goal math. The demo SHALL simulate
the overlays' outputs, not the AI's decision quality.

#### Scenario: Simulated chat populates activity

- **WHEN** demo is on and the Activity tab is open
- **THEN** simulated messages arrive over time and appear in the chat with the same
  affordances as live

#### Scenario: Scores and features update

- **WHEN** the generator scores and features simulated messages
- **THEN** the competition/leaderboard and featured highlights update via the production
  standings and goal math

#### Scenario: Scope is visuals, not AI decisions

- **WHEN** the owner uses the demo
- **THEN** it reflects how the overlays and activity look and behave, not whether the
  model would pick those messages or scores

### Requirement: Demo toolbar state

While demo is on, the status toolbar SHALL show a Demo indicator and SHALL hide the Go
live, End stream, and Discard controls, because no stream-lifecycle action applies to a
simulated stream. The Save changes control SHALL remain, still saving the real Settings
form.

#### Scenario: Lifecycle controls hidden in demo

- **WHEN** demo is on
- **THEN** the toolbar shows a Demo indicator and hides Go live / End / Discard while
  keeping Save changes

#### Scenario: Lifecycle controls return when demo is off

- **WHEN** demo is turned off
- **THEN** the toolbar restores the real status and the Go live / End / Discard controls
  for the active stream state

### Requirement: Overlay-feed parity on the demo stage

The demo stage SHALL render the complete OBS overlay feed — highlighted
message, TTS card, and !ask exchange — as one stacked column inside the
highlight box, using the same presentational components as the real overlay
page, so the demo preview is visually identical to the OBS browser source.
The TTS card and !ask exchange SHALL each have a visibility toggle in the
overlay control panel, persisted with the rest of the demo layout.

#### Scenario: Demo TTS card matches the overlay

- **WHEN** a demo TTS request is approved
- **THEN** the stage shows the same TTS card the OBS overlay renders (speaker
  icon, author name, text) and plays the bundled sample voice clip, clearing
  when playback ends

#### Scenario: Demo !ask exchange matches the overlay

- **WHEN** a demo !ask request is approved with "Include AI answer" checked
- **THEN** the stage shows the mirrored exchange — question with the asker's
  name on top, VidsBot answer bubble beneath — for the same 10-second hold;
  unchecking the box shows the question card only

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
demo chat. The demo Activity view SHALL provide the same owner controls as
the real Activity tab: a TTS requests panel (approve/dismiss), an Ask
requests panel (approve with a per-row "Include AI answer" checkbox,
dismiss), a clip markers list, and a Wrap up button that — after a
confirmation dialog — posts the MVP (top demo scorer), an achievement
summary, and a thanks message as VidsBot rows, exactly once.

#### Scenario: Approving a TTS request

- **WHEN** the owner approves a suggested TTS request in the demo Activity
  panel
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
