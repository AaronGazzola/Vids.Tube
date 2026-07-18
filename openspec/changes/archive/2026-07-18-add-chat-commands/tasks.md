## 1. Data model

- [x] 1.1 Migration (`npx supabase migration new add_chat_commands`): `chat_commands`
  (id, channel_id → channels cascade, keyword, unique (channel_id, keyword), kind
  check builtin/custom, builtin_key, description, response, cooldown_s default 30,
  max_per_stream null, enabled default true, sort_order default 0,
  created_at/updated_at) and `command_events` (id, channel_id, stream_id → streams
  cascade, chat_message_id null, origin check vidstube/youtube, participant_key,
  keyword, args, status check executed/cooldown/limit/disabled/unknown, reply,
  created_at; index (stream_id, participant_key, keyword, created_at)); RLS: public
  select on `chat_commands` where enabled, owner-only select on `command_events`
  via channel ownership, no client writes on either
- [x] 1.2 Seed the `help` builtin for the existing channel in the same migration
  (insert-if-absent by (channel_id, keyword) from `channels`): kind builtin,
  builtin_key 'help', description 'List the available chat commands',
  cooldown_s 30, sort_order 0
- [x] 1.3 Push migration (`doppler run -- npx supabase db push`, owner-authorized) and
  regen `supabase/types.ts`

## 2. Parser

- [x] 2.1 `lib/chat-commands.ts`: `parseChatCommand(body)` per design.md regex
  (lowercased keyword, trimmed args, null for non-commands) + exported
  `ParsedChatCommand` type
- [x] 2.2 Unit test `tests/unit/chat-commands.test.ts`: `!help`, `!TTS hello there`,
  multiline args, `hello!`, `!`, `!!fun`, leading whitespace

## 3. Worker pipeline

- [x] 3.1 `worker/lib/commands.ts`: `loadCommandRegistry(channelId)` with 30s TTL
  cache; `CommandContext` with `reply()` writing to the event row; `BUILTIN_HANDLERS`
  with `help` (enabled commands by sort_order + `${NEXT_PUBLIC_SITE_URL}/{slug}/commands`);
  `processCommands(stream, channel, batch)` implementing unknown-once, disabled,
  cooldown, per-stream total, executed + handler dispatch per design.md, returning
  the non-command messages
- [x] 3.2 Wire into `worker/jobs/score.ts`: after ban-filtering the batch, run
  `processCommands` and score only the returned non-command messages; pass the
  channel slug into the pipeline for the guide URL

## 4. Guide page

- [x] 4.1 `app/[channelSlug]/commands/page.actions.ts`:
  `getChannelCommandsAction(slug)` — resolve channel by slug (null → not found),
  read enabled `chat_commands` ordered by sort_order via the server client (public
  RLS read)
- [x] 4.2 `app/[channelSlug]/commands/page.tsx` + `page.hooks.tsx`: public page
  rendering `!keyword`, description, cooldown ("every Ns" when > 0), "N per stream"
  when limited; loading skeleton for the list only; empty state; not-found state

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean
- [x] 5.2 `scripts/verify-chat-commands.ts` (snapshot→act→assert→cleanup, remote db,
  guarded on no active stream): seed a dated scheduled stream with scoring enabled;
  run the worker; post `!help`, a repeat `!help` inside the cooldown, `!nope`, and a
  repeat `!nope`; assert `command_events` has executed (with reply containing the
  guide URL), cooldown, and exactly one unknown row; assert the `!help` messages
  earned no `score_events`; cleanup all rows
- [x] 5.3 e2e (`tests/e2e/chat-commands.spec.ts`): `/{ownerSlug}/commands` renders
  the seeded `!help` with description while signed out; unknown slug shows
  not-found
- [x] 5.4 `npx openspec validate add-chat-commands --strict`
