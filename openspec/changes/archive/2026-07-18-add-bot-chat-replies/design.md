## Context

`processCommands` (worker/lib/commands.ts) already produces reply text per
executed/unknown command and stores it on `command_events.reply`. Chat rendering
branches on `chat_messages.origin` in `components/chat-author.tsx` (youtube →
author_name/avatar + badge; otherwise resolved vids.tube identity). The origin
column is unconstrained text and `user_id` is nullable, so a `'bot'` origin
needs no migration. Nightbot's `channel/send` endpoint takes
`Authorization: Bearer <token>` with the `channel_send` scope, max 400 chars,
1 request per 5 seconds.

## Goals / Non-Goals

- Goals: origin-local reply delivery; VidsBot identity on vids.tube; safe,
  rate-limited, config-gated Nightbot sends; the bot's own output never
  re-enters ingestion/scoring/stats.
- Non-goals: owner Nightbot setup (Linear); proactive messages (later change
  reuses the sender).

## Decisions

- **Origin-local replies**: a command typed in vids.tube chat is answered in
  vids.tube chat; one typed in YouTube chat is answered via Nightbot. No
  cross-posting.
- **VidsBot rows**: `insert chat_messages { stream_id, origin:'bot',
  user_id:null, author_name:'VidsBot', body }` via the worker's service role.
  `ChatAuthor` gets a `bot` branch (Bot icon avatar, name "VidsBot",
  `OriginBadge` variant `BOT` in indigo); `ChatMessageRow` in panels.tsx renders
  bot rows without the three-dot menu and without a score badge. Bot rows are
  naturally excluded from scoring/commands because the worker fetches only
  `origin='vidstube'` rows, and from stats because they carry no
  user_id/external id.
- **Nightbot sender** (`worker/lib/replies.ts`): a module-level FIFO queue;
  `sendYoutubeReply(text)` enqueues; a drain loop posts to
  `https://api.nightbot.tv/1/channel/send` with
  `NIGHTBOT_CHANNEL_SEND_TOKEN`, spacing sends by `NIGHTBOT_SEND_SPACING_MS`
  (default 5200), truncating to 400 chars on a word boundary with `…`. Missing
  token → one `console.error` skip per process; non-2xx logged with body,
  message dropped (no retry storm; 429 retries once after the spacing window).
- **Reply routing** in `processCommands`: after recording the event, call
  `deliverReply({ origin, streamId, text })` — vidstube/bot path inserts the
  chat row; youtube path enqueues Nightbot. Unknown-command pointer replies
  route the same way.
- **Ingestion exclusion** in `worker/lib/youtube-chat.ts`: drop a polled message
  when `authorChannelId === process.env.NIGHTBOT_YOUTUBE_CHANNEL_ID` (when set)
  or `displayName === 'Nightbot'`, before persisting or buffering.

## Risks / Trade-offs

- Until the owner completes Nightbot setup (Linear), YouTube repliers no-op with
  a logged skip — commands still fully work on vids.tube.
- Display-name matching for Nightbot exclusion could theoretically drop an
  impersonator named "Nightbot" — acceptable (such a message is noise anyway);
  the channel-id env pin is the precise filter once set.
