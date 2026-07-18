## Component extraction

`components/overlay/ask-exchange.tsx` exports `AskExchangeView({ authorName,
question, answer, includeAnswer })` and `components/overlay/tts-card.tsx`
exports `TtsCard({ authorName, text, audioSrc, onDone })` — the exact JSX
currently inlined in `app/(overlay)/overlay/[channelSlug]/page.tsx`. The
overlay page keeps its data wiring (queues, hold timer, mark-shown/played
actions) and renders the shared views; the demo renders the same views from
store state. The TTS card owns the `<audio autoPlay onEnded/onError>`
element keyed by request id.

## Demo state

`demo.types.ts`: `DemoOverlayKey` widens to `DemoBoxKey | "tts" | "ask"`
(boxes unchanged — TTS and ask render inside the highlight box's column,
matching the single OBS browser source). `visible` covers all 7 keys,
defaults true; `mergeDemoLayout` already defaults missing keys, so old saved
layouts hydrate cleanly and no migration is needed.

`demo.stores.ts` generator additions:

- `tts: DemoTtsRequest[]` — `{ id, viewerKey, text, status:
  "suggested" | "approved" | "dismissed" | "played" }`
- `asks: DemoAskRequest[]` — `{ id, viewerKey, question, answer,
  includeAnswer, status: "suggested" | "approved" | "dismissed" | "shown" }`
- `clips: DemoClipMarker[]` — `{ id, viewerKey, note, at }` (fake stream
  timestamp derived from seq)
- `wrapupDone: boolean`; `DemoMessage` gains `bot: boolean` for VidsBot rows.
- `seed()` starts with exactly one suggested tts, two suggested asks, and one
  clip marker (deterministic first paint); `tick()` adds more at ~6%/6%/4%
  rolls using canned line pools, each emitting the `!command` chat message +
  a VidsBot ack row.
- Actions: `approveTts`, `dismissTts`, `markTtsPlayed`, `approveAsk(id,
  includeAnswer)`, `dismissAsk`, `markAskShown`, `runWrapup()` (stamps
  `wrapupDone`, appends MVP — top demo scorer — plus canned summary and
  thanks bot messages).

## Stage and Activity

Stage: inside the highlight DraggableBox, a 420-wide column renders
`HighlightField`, then (if `visible.tts`) the first approved-unplayed TTS via
`TtsCard` with `audioSrc="/demo/tts-sample.mp3"`, then (if `visible.ask`)
the first approved-unshown ask via `AskExchangeView` with a 10 s hold timer.
The control panel maps over the widened label set, so the two new switches
appear automatically.

Activity: three collapsible sections (TTS requests, Ask requests, Clip
markers) styled like the existing Competition/ModBot sections, plus a Wrap up
button with the same AlertDialog copy as the real one; after firing it shows
a disabled "Wrap-up sent" state. Ask rows carry an "Include AI answer"
checkbox (default checked) that feeds `approveAsk`.

## Sample audio

`public/demo/tts-sample.mp3` is generated once with the channel's ElevenLabs
voice (short clip) and committed. Served same-origin, so the existing
CSP `media-src 'self'` already allows it.
