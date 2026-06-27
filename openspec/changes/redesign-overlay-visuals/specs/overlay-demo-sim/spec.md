## ADDED Requirements

### Requirement: Portrait demo stage with per-element placement

The demo (`/studio/demo`) SHALL present a portrait (9:16) stage and SHALL let the owner
position and size each overlay element independently — each goal bar, the highlight
card, and the floating-bubbles field as its own draggable/resizable element — so the
layout matches the separate OBS Browser Sources used live.

#### Scenario: Portrait stage

- **WHEN** the owner opens the demo
- **THEN** the stage is a tall portrait area sized for a vertical stream

#### Scenario: Each element moves independently

- **WHEN** the owner drags one goal bar (or the highlight card, or the bubbles field)
- **THEN** only that element moves, independent of the others

### Requirement: Simulate the full live UX

The demo SHALL simulate the live AI flow with client-side state (no DB, worker, or
YouTube): post a chat message as a roster viewer, highlight it (rendering the message
card with that text and the author's ringed avatar), and raise/lower a viewer's score
(re-ranking and moving the floating bubbles). It SHALL make clear it simulates the AI's
outputs, not its decision quality.

#### Scenario: Walk a message from chat to highlight

- **WHEN** the owner posts a simulated chat message and highlights it
- **THEN** the highlight card shows that author and message text

#### Scenario: Scores move the bubbles and ranks

- **WHEN** the owner changes a viewer's simulated score
- **THEN** the floating bubbles re-rank and that viewer's ring/badge updates

#### Scenario: Scope is outputs, not decisions

- **WHEN** the owner uses the demo
- **THEN** it reflects how the overlays look and behave, not whether the model would pick
  those messages or scores
