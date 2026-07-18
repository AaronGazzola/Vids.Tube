## Why

The TTS card and !ask exchange look nothing like the highlight overlay (flat
dark chips vs the avatar + bordered speech bubble), and the three elements
stack vertically so they can appear simultaneously. The owner wants one
visual language and one screen position: every feed element renders in the
highlight's style — requester avatar top-left, message in the same speech
bubble — with the ask answer mirrored (bubble on the left, pointer pointing
right, bot icon on the right), and only ever one element on screen at a time.
The dashed "Highlight" placeholder must remain a demo-only aid, never visible
to the live audience.

## What Changes

- **Shared speech bubble**: the highlight's bordered bubble + pointer is
  extracted into `SpeechBubble` (left- or right-pointing) used by the
  highlight, the TTS card, and both halves of the ask exchange.
- **TTS card restyled**: requester `AvatarBubble` (with their standings
  ring/rank, like the highlight) top-left, name/handle beneath, spoken text
  in the speech bubble with a small speaker icon; audio behavior unchanged.
- **Ask exchange restyled**: the question renders exactly like a highlight
  (avatar left, bubble right); the answer renders mirrored — bubble on the
  left with the pointer pointing right at an indigo bot icon labeled VidsBot
  on the right. Include-answer behavior unchanged.
- **Single overlay slot**: the real overlay page and the demo stage render at
  most one feed element at a time in the same position, priority
  highlight → TTS → ask; queued items wait their turn (TTS audio only starts
  when its card holds the slot). Real playable TTS/ask rows gain the author
  (avatar via the linked chat message / resolved identity) and participant
  key (for the standings ring).
- **Placeholder stays demo-only**: the dashed "Highlight" outline exists only
  on the demo stage; the real overlay page renders nothing when idle
  (asserted in e2e).

## Capabilities

- `tts-requests` (modified) · `ai-commands` (modified) · `live-demo-mode`
  (modified)
