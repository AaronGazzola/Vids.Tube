## 1. Data model

- [x] 1.1 Migration `add_ask_requests`: `ask_requests` per design.md (including
  `include_answer boolean not null default true` and `answer_delivered_at`),
  RLS (owner all; anon approved/shown), `chat_scoring_state.ask_mode` default
  'suggest' check suggest/auto, seeds for `ask` (cooldown 120, sort 31) and
  `catchup` (cooldown 60, sort 32)
- [x] 1.2 Push migration + regen types

## 2. Worker

- [x] 2.1 `worker/lib/ask-command.ts`: grounding builder (enabled custom
  commands + transcript window), the single moderate+answer Claude prompt with
  JSON verdict, `askHandler` (dismiss silently / can't-answer reply / auto:
  approved+reply / suggest: suggested+await ack), and
  `deliverApprovedAskAnswers(streamId)` — per-pass sweep replying approved
  include-answer rows with null `answer_delivered_at` to the asker's origin and
  stamping delivery
- [x] 2.2 `worker/lib/catchup-command.ts`: `catchupHandler` with the 180s
  in-memory cache, transcript summary prompt, 400-char truncation, and the
  no-transcript line
- [x] 2.3 Register `ask` + `catchup` in `BUILTIN_HANDLERS`; call
  `deliverApprovedAskAnswers` in the scoring pass next to
  `synthesizePendingTts`

## 3. Mode + owner panel

- [x] 3.1 `ask_mode` plumbing: StreamSettings/StreamSettingsInput/SettingsForm +
  read/write on `chat_scoring_state` + "Auto-answer !ask (vs suggest)"
  SwitchRow in the Mod bot section
- [x] 3.2 Actions `getAskFeedAction`/`approveAskAction(id, includeAnswer)`/
  `dismissAskAction` in `app/(app)/live/page.actions.ts` (+ hooks), approval
  setting `include_answer` and status approved (suggested-only guard)
- [x] 3.3 `panels.tsx`: "Ask requests" collapsible panel — suggested rows show
  question, generated answer, reasoning, an "Include AI response" checkbox
  (default checked), Approve, Dismiss; recent non-suggested rows with status
  badges

## 4. Overlay

- [x] 4.1 Overlay actions: `getPlayableAskAction(streamId)` (approved, approval
  order) + `markAskShownAction(id)` (approved→shown); hook polling 2s
- [x] 4.2 Overlay page: `AskExchange` — question card in the highlight style,
  answer (only when `include_answer`) mirrored below with the bot avatar on the
  right, 10s hold, mark shown

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 5.2 `scripts/verify-ai-commands.ts` (guarded, remote db, short cooldowns):
  seed scheduled stream + scoring + a custom FAQ command (`!pc` with a known
  response) + transcript segments; run the worker; `!ask what pc do you use`
  (suggest mode) → suggested row whose answer references the FAQ content +
  awaiting ack; abusive `!ask` → dismissed silently; ungroundable `!ask` →
  can't-answer reply, no row; approve the suggestion with includeAnswer via the
  DB (status approved) → next pass delivers the answer reply and stamps
  `answer_delivered_at`; flip ask_mode auto, groundable `!ask` → approved +
  immediate answer reply; `!catchup` twice within 3 minutes → identical ≤400
  replies and one generation (second reply identical + log shows one summary);
  cleanup
- [x] 5.3 e2e (`tests/e2e/ask.spec.ts`): seed a live stream + suggested
  exchange → Activity panel shows question/answer/reason with the checkbox;
  Approve with checkbox on flips the row (include_answer true); seed an
  approved exchange → the overlay shows the question card and the mirrored bot
  answer, then the row flips shown
- [x] 5.4 `npx openspec validate add-ai-commands --strict`
