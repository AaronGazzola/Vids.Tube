## 1. Data

- [x] 1.1 Migration (`npx supabase migration new add_chat_bridge`):
  `alter table chat_scoring_state add column bridge_enabled boolean not null
  default true;` — push with `doppler run -- npx supabase db push --yes`,
  regen `supabase/types.ts`.

## 2. Worker

- [x] 2.1 `worker/lib/replies.ts`: split the queue into `replyQueue`
  (unbounded, existing behavior) and `bridgeQueue` (max 5, drop-oldest with a
  `console.error` count log); the drain loop always takes from `replyQueue`
  first; export `enqueueNightbotBridge(text)` using the same truncation,
  token, 401-refresh, and 429-retry paths.
- [x] 2.2 `worker/jobs/score.ts`: per pass, when `youtubeVideoId` is set,
  read `bridge_enabled` from `chat_scoring_state`; when enabled, for each
  post-`processCommands` batch message with `origin === "vidstube"`, call
  `enqueueNightbotBridge(`${authorName ?? author}: ${text}`)`. (Banned
  participants are already filtered out of the batch; command messages never
  reach it.)

## 3. Settings UI

- [x] 3.1 `app/(app)/live/broadcast.actions.ts`: thread `bridgeEnabled`
  through `StreamSettings`/input + get/save (chat_scoring_state column).
- [x] 3.2 `app/(app)/live/settings-tab.tsx` + `page.tsx` buildForm/buildPayload:
  "Bridge chat to YouTube" SwitchRow (description: "Post vids.tube chat
  messages into the YouTube live chat via Nightbot"), default true, saved via
  the toolbar Save.

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 4.2 `tests/unit/bot-replies.test.ts`: reply queued after bridged
  messages still sends first; 6th bridged enqueue drops the oldest (sender
  sees the newest 5); bridged sends reuse truncation.
- [x] 4.3 e2e `tests/e2e/chat-bridge.spec.ts` (guarded, port 3001): the
  Settings tab shows "Bridge chat to YouTube" defaulting on; toggling it off
  and saving persists `bridge_enabled=false` on the stream's
  `chat_scoring_state` row (DB poll), and back on restores true; cleanup.
- [x] 4.4 Real YouTube delivery is owner-verified (AZ-157/AZ-158) — add the
  bridge check to AZ-157 via a Linear comment.
- [x] 4.5 `npx openspec validate add-vidstube-chat-bridge --strict`.
