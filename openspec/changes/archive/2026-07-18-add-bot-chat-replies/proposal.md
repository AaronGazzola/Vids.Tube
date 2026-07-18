## Why

The command layer records replies but nothing delivers them. Commands only feel
alive when the bot answers in the chat the viewer used: as **VidsBot** in
vids.tube chat, and through **Nightbot's send API** in the merged YouTube chat.
This change turns the `reply()` abstraction into real deliveries, and keeps the
bot's own messages out of ingestion, scoring, and stats.

## What Changes

- A **bot origin** for vids.tube chat: `chat_messages.origin` gains `'bot'`;
  bot rows carry `author_name = 'VidsBot'` and no `user_id`. Chat UIs render
  them with a distinct VidsBot identity (bot avatar, no score badge, no
  moderation menu). Bot rows are excluded from scoring, viewer stats, and the
  command pipeline by origin.
- A **worker reply sender** (`worker/lib/replies.ts`): command replies are
  delivered to the origin the command came from —
  - vids.tube → insert a `origin='bot'` row into `chat_messages`;
  - YouTube → `POST https://api.nightbot.tv/1/channel/send` with the
    `NIGHTBOT_CHANNEL_SEND_TOKEN` Doppler secret, through a queue that spaces
    sends ≥ 5.2s apart (Nightbot's 1-per-5s limit) and truncates to 400 chars.
    A missing token logs a clear skip and never throws.
- **Nightbot ingestion exclusion**: the YouTube poller drops messages authored
  by Nightbot (author channel id equals `NIGHTBOT_YOUTUBE_CHANNEL_ID` when set,
  or display name exactly `Nightbot`), so the bot's own sends are never scored,
  stored, or re-processed.
- `processCommands` wires handler replies into the sender (still recording the
  text on `command_events.reply`).

## Capabilities

### New Capabilities

- `bot-chat-replies`: the bot origin and its rendering, origin-local reply
  delivery, the Nightbot send queue with rate limit and truncation, and the
  ingestion exclusion.

## Non-goals / Related

- Owner-side Nightbot setup (connect Nightbot to the YouTube channel, register a
  Nightbot API application, put the `channel_send` token in Doppler) is manual —
  tracked as a Linear issue, not tasks here. Until the token exists the YouTube
  path is code-complete but skipped at runtime; verifying a real Nightbot send
  is a Linear verification item.
- Proactive/bot-initiated messages (`add-bot-moments`) and wrap-up messages —
  they will reuse this sender.

## Impact

- No migration: `chat_messages.origin` is unconstrained text, so `'bot'` rows
  insert as-is via the service role; the worker's vids.tube fetch already
  filters `origin='vidstube'`, excluding bot rows from scoring and commands.
- `worker/lib/replies.ts` (new), `worker/lib/commands.ts` (deliver replies),
  `worker/lib/youtube-chat.ts` (Nightbot exclusion).
- Chat rendering: `components/chat-author.tsx` + `components/origin-badge.tsx`
  render `origin='bot'` rows as VidsBot; `app/(app)/live/panels.tsx` hides the
  moderation menu and score badge on bot rows.
- `scripts/verify-bot-replies.ts` verification script.
