## Context

The worker's scoring loop (`worker/jobs/score.ts` `runScoringJob`) already sees
every chat message from both origins each pass: `fetchNewVidstube` (vids.tube rows
newer than a cursor) and the in-memory `ytBuffer` filled by `pollYoutubeChat`
(YouTube messages, also persisted to `chat_messages`). That loop is the single
place both streams of messages converge while a broadcast is engaged, so command
execution lives there. Commands remain ordinary visible chat messages (decided);
nothing is swallowed.

## Goals / Non-Goals

- Goals: one deterministic command layer every later feature plugs into; tunable
  per-command cooldown/total limits as data; full auditability of every command
  attempt; a public guide page.
- Non-goals: sending replies (next change), custom commands and management UI
  (later change), commands working without the worker.

## Decisions

### Data model

`chat_commands` (registry):

- `id uuid pk`, `channel_id uuid -> channels on delete cascade`,
  `keyword text` (lowercase, no `!`), unique `(channel_id, keyword)`,
  `kind text check in ('builtin','custom')`, `builtin_key text null` (which
  handler a builtin binds to), `description text not null` (shown on the guide
  page and in `!help`), `response text null` (custom commands only, unused here),
  `cooldown_s int not null default 30`, `max_per_stream int null` (per-user per
  stream; null = unlimited), `enabled boolean not null default true`,
  `sort_order int not null default 0`, `created_at`/`updated_at`.
- RLS: public `select` where `enabled = true` (the guide page is public); no
  client writes (service role only). Owner management UI comes later.

`command_events` (execution log and the source of truth for limits):

- `id uuid pk`, `channel_id`, `stream_id uuid -> streams on delete cascade`,
  `chat_message_id uuid null`, `origin text check in ('vidstube','youtube')`,
  `participant_key text not null` (same convention as `viewer_scores`:
  `user_id` or `youtube:<externalAuthorId>`), `keyword text not null` (the typed
  keyword, lowercased; unknown commands log their typed keyword),
  `args text null`, `status text check in
  ('executed','cooldown','limit','disabled','unknown')`, `reply text null` (what
  the bot would/will say — populated by handlers; the send layer arrives in
  `add-bot-chat-replies`), `created_at timestamptz default now()`.
- Indexes: `(stream_id, participant_key, keyword, created_at)` for cooldown/limit
  lookups.
- RLS: owner-only select (via channel ownership); service-role writes.

### Parser

`lib/chat-commands.ts`: `parseChatCommand(body: string)` returns
`{ keyword: string, args: string }` when the trimmed body matches
`/^!([a-zA-Z0-9_]+)(?:\s+([\s\S]*))?$/` (keyword lowercased, args trimmed,
default empty string), else `null`. A lone `!` or `!!x` is not a command. Shared
by worker and any future UI.

### Worker pipeline

`worker/lib/commands.ts`:

- `loadCommandRegistry(channelId)` — enabled rows for the channel, cached for
  `COMMAND_REGISTRY_TTL_MS` (30s) so registry edits apply without a restart.
- `CommandContext` = `{ stream, channelId, message (BufferedMessage), args,
  reply(text: string): void }`. `reply` records the text onto the pending event
  row (`reply` column); the send layer is added by `add-bot-chat-replies`.
- `BUILTIN_HANDLERS: Record<string, (ctx) => Promise<void>>` — this change ships
  `help` only: replies with the enabled commands (keyword + description, ordered
  by `sort_order`) and the guide URL `${NEXT_PUBLIC_SITE_URL}/{slug}/commands`.
- `processCommands(stream, channel, batch)` — for each buffered message (both
  origins, already ban-filtered by the caller):
  1. `parseChatCommand`; not a command → keep for scoring.
  2. Registry lookup. Unknown keyword → if this participant has no prior
     `unknown` event this stream, log `unknown` with a pointer reply
     ("Unknown command — try !help"); else log nothing. Message is excluded from
     scoring either way (it was an attempted command, not chat content).
  3. Disabled row → log `disabled`, no reply.
  4. Cooldown: newest `executed` event for (stream, participant, keyword) newer
     than `cooldown_s` ago → log `cooldown`, no reply.
  5. Total: `max_per_stream` non-null and `executed` count for (stream,
     participant, keyword) reached → log `limit`, no reply (the handler for the
     specific command may customize this later).
  6. Otherwise insert the `executed` event, run the handler, update the event's
     `reply`/`args`.
- Returns the non-command messages so `runScoringJob` scores only real chat.

Wiring in `worker/jobs/score.ts`: after the batch is assembled and ban-filtered,
`batch = await processCommands(stream, channelId, batch)` before the scoring
prompt is built.

### Guide page

`app/[channelSlug]/commands/page.tsx` — public, resolves the channel by slug,
lists enabled commands (keyword styled as `!keyword`, description, cooldown when
> 0, "x per stream" when limited). Empty state when the channel has no enabled
commands. Standard page/actions/hooks file split; the action reads via the
publishable client (RLS provides the public read).

## Risks / Trade-offs

- Commands only run while the worker is engaged (public stream + scoring state
  enabled). Accepted and already true of the whole bot feature set.
- Cooldown/limit checks are per-worker-pass DB queries; at this chat volume that
  is negligible.
- Excluding command messages from the scoring batch means they never earn scores
  — intended (typing `!help` is not chat engagement).
