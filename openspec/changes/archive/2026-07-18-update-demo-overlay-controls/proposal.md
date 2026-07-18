## Why

Owner feedback on the demo after first use: the highlight overlay plays
continuously while TTS/ask only appear via Activity approvals — inconsistent
and hard to art-direct; the four interactivity panels stack too tall in the
Activity tab; and the collapsed Competition header wastes a row on its title.
The owner wants direct "play" control over each stage overlay, with an option
to freeze it on screen while arranging the OBS layout.

## What Changes

- **Overlay panel play controls**: under each of the Highlight, TTS card, and
  !ask exchange switch rows in the on-stage overlay panel: a **Play** button
  that shows one demo value on the stage (a promoted highlight, a TTS card
  with the sample voice clip, a full ask exchange), plus a **persist**
  checkbox that keeps that overlay on screen instead of auto-hiding.
- **Highlight is no longer continuous**: the stage highlight shows only
  *promoted* messages (owner's Highlight action in the demo chat, or the
  panel Play button). Generator-featured messages remain suggestions in the
  Activity chat, matching real behavior.
- **VidsBot actions panel**: the TTS requests, Ask requests, Clip markers,
  and Wrap up controls merge into one collapsible **"VidsBot actions"**
  component with a tab for each.
- **Competition header**: the collapsed state shows only the top-3 badges and
  chevron; the "Competition" title appears only when expanded.

## Capabilities

- `live-demo-mode` (modified)

## Out of scope

- Any change to the real overlay page or the Activity approval flows
  (approvals still play on the stage as shipped).
