## MODIFIED Requirements

### Requirement: Overlay-feed parity on the demo stage

The demo stage SHALL render the OBS overlay feed as a single slot inside the
highlight box, using the same presentational components as the real overlay
page: at most one of the highlighted message, TTS card, or ask exchange is
visible at a time (priority highlight → TTS → ask), each in the shared
highlight visual style, in the same position. The dashed "Highlight"
placeholder SHALL appear only on the demo stage when the slot is empty — the
real overlay page renders nothing when idle, so the audience never sees a
placeholder. In the overlay control panel, the Highlight, TTS card, and !ask
exchange rows SHALL each offer: a visibility toggle (persisted with the demo
layout), a **Play** button that displays one demo value on the stage
immediately, and a **persist** checkbox that keeps the played overlay on
screen instead of auto-hiding when its animation, audio, or hold timer ends.

#### Scenario: One element at a time

- **WHEN** a demo TTS request and a demo ask are both approved while a
  highlight is playing
- **THEN** the stage shows them one after another in the same position, never
  together

#### Scenario: Placeholder is demo-only

- **WHEN** the demo slot is empty
- **THEN** the dashed "Highlight" outline shows on the demo stage, while the
  real overlay page in the same state renders nothing

#### Scenario: Play buttons drive the stage

- **WHEN** the owner clicks Play under TTS card (or !ask exchange, or
  Highlight)
- **THEN** the stage immediately shows that demo value in the shared slot
  without touching the Activity tab

#### Scenario: Persist freezes the overlay

- **WHEN** persist is checked for an overlay and it is played
- **THEN** the overlay stays visible after its clip/hold/animation would have
  ended, until persist is unchecked or the element is replaced

#### Scenario: Toggles hide the new overlays

- **WHEN** the owner switches "TTS card" or "!ask exchange" off in the
  overlay panel
- **THEN** that element no longer renders on the stage and the preference
  persists with the saved demo layout
