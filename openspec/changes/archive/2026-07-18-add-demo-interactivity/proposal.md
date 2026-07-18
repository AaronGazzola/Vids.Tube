## Why

The demo mode on /live simulates chat, scoring, moderation, and the classic
overlays (highlight, goals, competition) — but none of the chat-interactivity
features shipped since: the TTS card, the !ask exchange, or the Activity-tab
request panels. The owner has no way to preview how those overlays render in
OBS or to rehearse the approve/dismiss flows without a real session. The demo
stage must show every overlay exactly as the real OBS browser source renders
it.

## What Changes

- **Shared overlay components**: the ask-exchange and TTS-card markup move
  out of the overlay page into presentational components
  (`components/overlay/ask-exchange.tsx`, `components/overlay/tts-card.tsx`)
  used by BOTH the real overlay page and the demo stage — pixel parity by
  construction.
- **Demo stage overlay feed**: the existing highlight box becomes the same
  stacked column the OBS source renders (highlight → TTS card → !ask
  exchange, width 420). Two new visibility toggles ("TTS card", "!ask
  exchange") join the overlay control panel; layout persistence picks the new
  keys up through the existing merge.
- **Simulated requests**: the demo generator seeds one suggested !tts, two
  suggested !asks, and one clip marker immediately (deterministic for
  first-render and e2e) and keeps producing them at low probability, each
  with the visible `!tts …` / `!ask …` / `!clip …` command message plus a
  VidsBot ack row in the demo chat.
- **Demo Activity panels**: TTS requests (approve/dismiss), Ask requests
  (approve with per-row "Include AI answer" checkbox, dismiss), clip markers
  list, and a Wrap up button (confirm dialog → MVP + summary + thanks bot
  messages into demo chat) — mirroring the real Activity tab.
- **Playback**: approving a TTS request plays a real bundled sample clip
  (`public/demo/tts-sample.mp3`, generated once with the channel's ElevenLabs
  voice) through the demo TTS card; approving an !ask shows the mirrored
  exchange for the same 10-second hold, with or without the answer per the
  checkbox.
- **VidsBot rows in demo chat** render with the bot identity (bot avatar,
  "VidsBot", BOT badge, no menu, no score).

## Capabilities

- `live-demo-mode` (modified)

## Out of scope

- Simulating proactive bot moments and !me bios in demo (tested live via the
  preview-session ticket AZ-158).
- Any change to real overlay behavior beyond the markup extraction.
