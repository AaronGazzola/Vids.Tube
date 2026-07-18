## ADDED Requirements

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
