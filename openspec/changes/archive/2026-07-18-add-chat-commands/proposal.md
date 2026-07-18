## Why

Viewers should be able to interact with the stream by typing "!" commands in chat
(on vids.tube and in the merged YouTube chat). Everything later in the program —
bot replies, `!me`, info commands, `!tts`, `!ask`, `!clip` — needs one shared,
deterministic command layer: detection, a registry with per-command tunables,
per-user cooldowns and per-stream totals, and an auditable execution log. This
change builds that core plus the first built-in (`!help`) and the public
per-channel command guide page.

## What Changes

- A **command registry** table (`chat_commands`): per-channel rows with `keyword`,
  `kind` (`builtin`/`custom`), `description`, `cooldown_s`, `max_per_stream`, and
  `enabled` — all limits tunable as data, never constants. This change seeds only
  the `help` built-in; later changes add their own rows.
- A **command event log** (`command_events`): one row per detected command with a
  `status` (`executed`/`cooldown`/`limit`/`disabled`/`unknown`); cooldown and
  total-limit accounting read from this log, and verification/audit reads it too.
- A **deterministic parser** (shared `lib/chat-commands.ts`): a message whose
  trimmed body starts with `!` followed by a keyword is a command; keyword
  matching is case-insensitive; the rest is the argument string. No AI involved.
- A **worker command pipeline** (`worker/lib/commands.ts`) run inside the existing
  scoring loop for both origins (vids.tube rows and polled YouTube messages),
  before scoring: banned participants are ignored, cooldowns/limits enforced from
  the event log, matched handlers dispatched with a `reply(text)` abstraction
  (a no-op queue until `add-bot-chat-replies` wires Nightbot/VidsBot into it).
  Command messages are excluded from the AI scoring batch but stay visible in chat.
- **`!help`** built-in: replies with the main command list and the public guide
  URL. An unknown `!xyz` gets one pointer-to-`!help` reply per user per stream.
- A public **command guide page** at `/{channelSlug}/commands` listing the
  channel's enabled commands (keyword, description, cooldown).

## Capabilities

### New Capabilities

- `chat-commands`: the registry, the event log, the parser, the worker pipeline
  with cooldowns/limits, `!help`, unknown-command handling, and the public guide
  page.

## Non-goals / Related

- No outbound chat messages yet — `reply()` is an abstraction that
  `add-bot-chat-replies` implements; until then replies are logged, not sent.
- No custom text commands or per-stream include/exclude toggles or management UI
  (`add-info-commands`).
- Commands work only while the worker is engaged on the stream — accepted; the
  owner-facing worker warning UI lands with the command management UI in
  `add-info-commands`.

## Impact

- New migration: `chat_commands`, `command_events`, RLS (public read of enabled
  commands; owner read of events; writes via service role only) + types regen.
- New `lib/chat-commands.ts` (parser, shared types).
- New `worker/lib/commands.ts` (registry load, cooldown/limit checks, dispatch,
  reply queue) wired into `worker/jobs/score.ts`.
- New `app/[channelSlug]/commands/page.tsx` (+ `page.actions.ts`, `page.hooks.tsx`)
  public guide page.
- New `scripts/verify-chat-commands.ts` verification script.
