## 1. Stage + panel

- [x] 1.1 `components/overlay/highlighted-message.tsx`: optional
  `persist?: boolean` prop — when true the pop animation is disabled
  (`animation: none`) so the card holds on screen; default behavior (real
  overlay) unchanged.
- [x] 1.2 `demo.stores.ts` (generator): `playHighlight()` (appends a promoted
  message from a random viewer with a random feature line + score bump),
  `playTts()` (appends an approved TTS request from the canned pool),
  `playAsk()` (appends an approved ask with `includeAnswer: true`).
- [x] 1.3 `demo.stores.ts` (layout): ephemeral `persist: { highlight, tts,
  ask }` flags + `setPersist(key, v)` (not saved to the layout config).
- [x] 1.4 `demo-preview.tsx`: `HighlightField` shows only
  `promoted && !dismissed` messages; when `persist.highlight` it passes
  `persist` to `HighlightedMessage` and ignores `onDone`. `DemoTtsFeed` skips
  `markTtsPlayed` on end while `persist.tts` (card holds; audio still plays
  once). `DemoAskFeed` skips the 10 s hold while `persist.ask`. The control
  panel renders, under each of the Highlight / TTS card / !ask exchange
  switch rows, a "Play" button wired to the play action and a "persist"
  checkbox wired to the persist flag.

## 2. Activity

- [x] 2.1 `demo-activity.tsx`: `Competition` collapsed state renders the
  top-3 badges + chevron only; the "Competition" title renders only when
  expanded.
- [x] 2.2 `demo-activity.tsx`: replace the four stacked sections with one
  collapsible "VidsBot actions" panel containing Tabs — "TTS" (requests
  list), "Ask" (requests list with Include AI answer checkboxes), "Clips"
  (markers list), "Wrap up" (the confirm-dialog button) — reusing the
  existing row markup inside each tab.

## 3. Verify

- [x] 3.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 3.2 `tests/e2e/demo-interactivity.spec.ts` updated: panels reached via
  the VidsBot actions tabs; approval flow still plays on the stage; new
  coverage — stage highlight stays empty until Play (or a promote) fires;
  Play under TTS card shows the card; with persist checked the TTS card
  remains visible well past the clip length, and unchecking persist releases
  it; collapsed competition shows no "Competition" title until expanded.
  Suite green on port 3001.
- [x] 3.3 `npx openspec validate update-demo-overlay-controls --strict`.
