## 1. Shared overlay components

- [x] 1.1 `components/overlay/ask-exchange.tsx`: `AskExchangeView({
  authorName, question, answer, includeAnswer })` — the exact exchange JSX
  from the overlay page (question card with MessageCircleQuestion + amber
  author, indigo VidsBot answer bubble rendered only when `includeAnswer` and
  `answer`).
- [x] 1.2 `components/overlay/tts-card.tsx`: `TtsCard({ authorName, text,
  audioSrc, onDone })` — the TTS card JSX plus the `<audio autoPlay
  onEnded={onDone} onError={onDone}>` element.
- [x] 1.3 `app/(overlay)/overlay/[channelSlug]/page.tsx`: `AskExchange` and
  `TtsPlayer` keep their queue/timer/mark logic but render the shared views.

## 2. Demo state

- [x] 2.1 `demo.types.ts`: `DemoOverlayKey = DemoBoxKey | "tts" | "ask"`;
  labels "TTS card" / "!ask exchange"; `visible` defaults true for both;
  `DEMO_OVERLAY_KEYS` extended.
- [x] 2.2 `demo.stores.ts`: `DemoTtsRequest`, `DemoAskRequest` (with
  `includeAnswer`), `DemoClipMarker`, `wrapupDone`, `DemoMessage.bot`;
  `seed()` starts with one suggested tts + two suggested asks + one clip
  marker; `tick()` produces more at ~6%/6%/4% with canned pools, each
  appending the `!command` chat message and a VidsBot ack row; actions
  `approveTts` / `dismissTts` / `markTtsPlayed` / `approveAsk(id,
  includeAnswer)` / `dismissAsk` / `markAskShown` / `runWrapup()` (three bot
  rows, MVP = top scorer, sets `wrapupDone`).

## 3. Stage

- [x] 3.1 `demo-preview.tsx`: highlight box renders the 420-wide overlay
  column — `HighlightField`, then first approved-unplayed TTS via `TtsCard`
  (`audioSrc="/demo/tts-sample.mp3"`, onDone → `markTtsPlayed`), then first
  approved-unshown ask via `AskExchangeView` with a 10 s timer →
  `markAskShown`; sections gated by `visible.tts` / `visible.ask`. Control
  panel switches appear via the widened label map.

## 4. Activity

- [x] 4.1 `demo-activity.tsx`: collapsible "TTS requests" (text + author,
  Approve/Dismiss on suggested, status chip otherwise), "Ask requests"
  (question + canned answer preview, per-row "Include AI answer" checkbox
  default checked, Approve/Dismiss), and "Clip markers" (time + note +
  author) sections; "Wrap up" button with AlertDialog (same copy as the real
  one) → `runWrapup()`, then disabled "Wrap-up sent".
- [x] 4.2 `demo-activity.tsx` ChatRow: `msg.bot` rows render Bot-icon avatar,
  "VidsBot", `OriginBadge origin="bot"`, no MessageMenu, no ScoreBadge.

## 5. Sample audio

- [x] 5.1 Generate `public/demo/tts-sample.mp3` once via the ElevenLabs API
  with the configured voice (short clip) and commit it.

## 6. Verify

- [x] 6.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 6.2 e2e `tests/e2e/demo-interactivity.spec.ts` (guarded on no active
  stream, port 3001): demo on /live shows the seeded TTS/ask/clip entries;
  approving the TTS renders the card on the stage and it reaches "played"
  after the clip ends; approving the ask with the checkbox shows question +
  answer, and a second ask approved without it shows the question only;
  Wrap up → three VidsBot rows with BOT badge and the button disables;
  switching "TTS card" off removes it from the stage.
- [x] 6.3 `npx openspec validate add-demo-interactivity --strict`.
