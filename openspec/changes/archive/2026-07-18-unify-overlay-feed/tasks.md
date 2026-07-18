## 1. Shared components

- [x] 1.1 `components/overlay/speech-bubble.tsx`: `SpeechBubble({ pointer:
  "left" | "right", children })` — the highlight's bordered black bubble with
  glow and the svg pointer, mirrored to the right edge when
  `pointer="right"`.
- [x] 1.2 `components/overlay/highlighted-message.tsx` renders its bubble via
  `SpeechBubble` (visual output unchanged).
- [x] 1.3 `components/overlay/tts-card.tsx`: highlight layout — `AvatarBubble`
  (size 72, standings ring via `rank`/`progress` props, badge when ranked) +
  handle/name column, `SpeechBubble` containing a small `Volume2` icon and
  the text; keeps the `<audio autoPlay onEnded/onError>` element. Props
  become `{ author, rank, progress, text, audioSrc, audioKey, onDone }`.
- [x] 1.4 `components/overlay/ask-exchange.tsx`: question block identical to
  the highlight layout (avatar column + left-pointer bubble); answer block
  (when `includeAnswer && answer`) mirrored — right-pointer `SpeechBubble` on
  the left, indigo circled `Bot` icon with a "VidsBot" label on the right.
  Props become `{ author, rank, progress, question, answer, includeAnswer }`.

## 2. Real overlay

- [x] 2.1 `app/(overlay)/overlay/[channelSlug]/page.actions.ts`:
  `PlayableTts`/`PlayableAsk` gain `author: FeaturedAuthor | null` and
  `participantKey: string` — resolved by selecting `origin, participant_key,
  chat_message_id`, batch-fetching linked `chat_messages`
  (`author_avatar_url`), and `resolveAuthorIdentities` for vids.tube
  participant keys, composed with `authorFromRow`.
- [x] 2.2 `app/(overlay)/overlay/[channelSlug]/page.tsx`: single-slot
  render — the page picks at most one element (current promoted highlight,
  else first unplayed TTS, else first unshown ask) and renders it in the one
  position; the TTS audio element mounts only while its card holds the slot;
  standings ring for TTS/ask via the existing standings map and the row's
  `participantKey`; done-marking (`markTtsPlayedAction`,
  `markAskShownAction`, highlight done set) unchanged.

## 3. Demo stage

- [x] 3.1 `demo-preview.tsx`: replace the stacked
  `HighlightField`/`DemoTtsFeed`/`DemoAskFeed` column with one
  `DemoOverlayFeed` that picks a single element (visible.highlight &&
  promoted message) → (visible.tts && approved tts) → (visible.ask &&
  approved ask), renders it via the shared components with demo authors and
  standings, honors the `persist` flags exactly as before, and shows the
  dashed "Highlight" placeholder only when the slot is empty.

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 4.2 e2e green (port 3001): `tests/e2e/demo-interactivity.spec.ts`
  (existing text assertions hold for the restyled components; add a
  single-slot assertion — approve a TTS while a persisted highlight is
  showing and the TTS text stays absent until the highlight is released);
  `tests/e2e/tts.spec.ts` overlay test extended with an idle assertion (after
  `played`, the overlay page contains no dashed placeholder and no
  "Highlight" text); `tests/e2e/ask.spec.ts` overlay test still verifies the
  question, answer, and "VidsBot" label.
- [x] 4.3 `npx openspec validate unify-overlay-feed --strict`.
