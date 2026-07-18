## 1. Real Activity

- [x] 1.1 `app/(app)/live/page.actions.ts`: `getTtsFeedAction`,
  `getAskFeedAction`, `getClipMarkersAction` select `chat_message_id` and
  return it on `TtsFeedItem` / `AskFeedItem` / `ClipMarker`
  (`chatMessageId`).
- [x] 1.2 `app/(app)/live/panels.tsx` `ChatPanel`: build
  `chat_message_id → request` maps from the three feeds and pass matches to
  `ChatMessageRow`.
- [x] 1.3 `ChatMessageRow` branches: suggested TTS → violet card
  (`border-violet-400/50 bg-violet-400/10`) with reasoning +
  Approve/Dismiss; suggested ask → sky card (`border-sky-400/50
  bg-sky-400/10`) with answer preview + Answer / Question only / Dismiss
  (wired to `useApproveAsk` include=true/false and `useDismissAsk`); handled
  tts/ask rows → normal styling + color-matched status chip; clip-linked
  rows → emerald accent (`border-l-2 border-emerald-400`) + `formatClipTime`
  chip.
- [x] 1.4 `ActivityContent`: remove `TtsRequestsPanel` and `AskRequestsPanel`
  (delete the components); render `ClipMarkersPanel` only in the no-stream
  branch; remove the Activity `WrapupButton` row and export `WrapupButton`.
- [x] 1.5 `app/(app)/live/page.tsx` toolbar: while live (and not demo),
  render `WrapupButton` immediately left of the "End stream" button.

## 2. Demo

- [x] 2.1 `demo.stores.ts`: `DemoTtsRequest` / `DemoAskRequest` /
  `DemoClipMarker` gain `messageId` (the linked demo chat message id) —
  threaded through seeds and tick; `playTts`/`playAsk` keep `messageId:
  null`.
- [x] 2.2 `demo-activity.tsx`: delete `VidsBotActions` (and the per-tab list
  components); `ChatRow` gains the same inline branches as the real chat
  (violet TTS card, sky ask card with the three buttons, emerald clip
  styling, status chips) driven by the generator stores; wrap-up moves out of
  Activity. Export the demo `WrapupButton` for the toolbar.
- [x] 2.3 `page.tsx`: while demo is on, render the demo wrap-up button in the
  toolbar where End stream sits outside demo.

## 3. Verify

- [x] 3.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 3.2 e2e updated and green (port 3001):
  `tests/e2e/demo-interactivity.spec.ts` (inline cards instead of tabs;
  Answer vs Question only; clip styling; toolbar wrap-up),
  `tests/e2e/tts.spec.ts` + `tests/e2e/ask.spec.ts` (panel interactions →
  chat-card interactions), `tests/e2e/clip.spec.ts` (post-stream shortlist
  still green; live styling assertion), `tests/e2e/moments.spec.ts` (wrap-up
  button found in the toolbar).
- [x] 3.3 `npx openspec validate integrate-activity-requests --strict`.

## 4. Consistency

- [x] 4.1 `panels.tsx` real `Competition`: collapsed state shows top-3 badges
  + chevron only; the "Competition" title renders only when expanded
  (matching the demo).
