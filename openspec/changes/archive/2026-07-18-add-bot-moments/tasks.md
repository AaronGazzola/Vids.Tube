## 1. Data model

- [x] 1.1 Migration `add_bot_moments`: `channel_projects` (public select RLS, no
  client writes), six `chat_scoring_state` booleans (proactive default false,
  wrap-up default true), `streams.wrapup_requested_at`/`wrapup_done_at`
- [x] 1.2 Push + regen types

## 2. Worker

- [x] 2.1 `worker/lib/moments.ts`: `sendBroadcast`, `runProactiveMoments`
  (env-overridable intervals, in-memory last-run, competition/progress/
  useful-info behaviors per design.md), `runWrapupIfRequested` (idempotent trio:
  MVP, Claude achievement summary <=400, thanks + project links)
- [x] 2.2 Wire both into the scoring pass; append the projects list to the
  `!ask` grounding builder

## 3. Settings + Activity UI

- [x] 3.1 Settings plumbing for the six toggles
  (StreamSettings/Input/SettingsForm + chat_scoring_state read/write) and a
  "Bot moments" section with six SwitchRows
- [x] 3.2 "Projects" Settings section: list + add/edit/delete dialogs
  (name/blurb/domain/repo) via owner-checked actions + hooks
  (`projects.actions.ts` / `projects.hooks.tsx`)
- [x] 3.3 Activity tab "Wrap up" button (confirm dialog explaining what will
  send) visible for an active stream; `requestWrapupAction(streamId)` stamps
  `wrapup_requested_at` (error when already requested)

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 4.2 `scripts/verify-moments.ts` (guarded, tiny intervals via env): seed
  scheduled stream + scores + transcript (with a factual musing) + two
  projects; enable all proactive toggles; run the worker → assert bot
  broadcasts for competition (top names), progress (project links), and useful
  info (the musing's answer); request wrap-up → assert the MVP, summary, and
  thanks (with links) bot rows sent exactly once (second request no-ops);
  cleanup
- [x] 4.3 e2e (`tests/e2e/moments.spec.ts`): Settings shows the Bot moments
  switches and the Projects manager (add + delete round-trip); a live stream
  shows the Wrap up button and confirming stamps `wrapup_requested_at`
- [x] 4.4 `npx openspec validate add-bot-moments --strict`
