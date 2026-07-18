## 1. Reply sender

- [x] 1.1 `worker/lib/replies.ts`: `deliverReply({ streamId, origin, text })` —
  vidstube → insert `chat_messages` row (`origin:'bot'`, `user_id:null`,
  `author_name:'VidsBot'`); youtube → `enqueueNightbotSend(text)`; plus the
  Nightbot queue: FIFO drained with `NIGHTBOT_SEND_SPACING_MS` (default 5200)
  spacing, 400-char word-boundary truncation with `…`, Bearer
  `NIGHTBOT_CHANNEL_SEND_TOKEN`, missing-token single logged skip, non-2xx logged
  and dropped, one retry after the spacing window on 429
- [x] 1.2 `worker/lib/commands.ts`: deliver handler and unknown-pointer replies
  through `deliverReply` (origin from the triggering message), keeping the
  `command_events.reply` recording

## 2. Nightbot ingestion exclusion

- [x] 2.1 `worker/lib/youtube-chat.ts`: in the poll loop, skip messages where
  `authorChannelId === process.env.NIGHTBOT_YOUTUBE_CHANNEL_ID` (when set) or
  `displayName === 'Nightbot'`, before persist/buffer

## 3. VidsBot rendering

- [x] 3.1 `components/origin-badge.tsx`: add a `bot` variant (indigo `BOT` chip)
- [x] 3.2 `components/chat-author.tsx`: add an `origin === 'bot'` branch — Bot
  icon avatar, name "VidsBot", `OriginBadge origin="bot"`
- [x] 3.3 `app/(app)/live/panels.tsx`: bot rows render without the three-dot
  `MessageMenu` and without a `ScoreBadge`

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean
- [x] 4.2 `scripts/verify-bot-replies.ts` (guarded, remote db): seed scheduled
  stream + scoring state; run the worker; post `!help` as the owner (vids.tube
  origin); assert a `chat_messages` row with `origin='bot'`,
  `author_name='VidsBot'` and the help reply exists for the stream, and that the
  bot row is absent from `score_events`/commands; cleanup
- [x] 4.3 e2e (`tests/e2e/bot-replies.spec.ts`): seed a live stream + a bot row
  via admin; the public `/{slug}/live` chat renders "VidsBot" with the BOT badge;
  the owner Activity chat shows the bot row without a three-dot menu
- [x] 4.4 Nightbot send path without a token: `scripts/verify-bot-replies.ts`
  calls `deliverReply({ origin: 'youtube', ... })` directly with
  `NIGHTBOT_CHANNEL_SEND_TOKEN` unset and asserts it resolves without throwing
  (skip path); truncation and spacing are unit-tested in
  `tests/unit/bot-replies.test.ts` (word-boundary 400-char truncation; queue
  spacing via injected clock/sender)
- [x] 4.5 `npx openspec validate add-bot-chat-replies --strict`
