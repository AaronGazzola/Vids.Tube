## 1. Data model

- [x] 1.1 Migration `add_me_profiles`: `me_profiles` (profile_key text pk,
  profile text not null, snapshot jsonb not null, generated_at timestamptz
  default now()); RLS owner-only select, no client writes; seed the `me`
  registry row for every channel (keyword 'me', kind builtin, builtin_key 'me',
  description 'A quick AI summary of your history on this channel',
  cooldown_s 600, sort_order 10, on conflict do nothing)
- [x] 1.2 Push migration + regen `supabase/types.ts`

## 2. Handler

- [x] 2.1 `worker/lib/me-command.ts`: `resolveMeIdentity(message)` (youtube →
  channel id; vidstube → user id + verified youtube_links lookup),
  `gatherMeStats(identity)` (chatter_stats + viewer_scores aggregate),
  `meProfileKey(identity)`, `needsRegeneration(snapshot, current)` (>= 20
  message delta or attended-count change), `truncateProfile(text)` (400-char
  word-boundary cap), the Claude prompt builder, the fixed first-timer reply,
  and the exported `meHandler(ctx)` wiring cache-read → generate-if-stale →
  reply "@name bio"
- [x] 2.2 Register `me` in `BUILTIN_HANDLERS` (worker/lib/commands.ts)

## 3. Verify

- [x] 3.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 3.2 `scripts/verify-me-command.ts` (guarded, remote db): seed a scheduled
  stream + scoring; run the worker; post `!me` as the owner (vids.tube user with
  history in viewer_scores from prior tests or seeded) → assert an executed
  command event with a non-empty reply <= 400 chars and a `me_profiles` row;
  post `!me` again after the cooldown row is cleared → assert the second reply
  came from cache (profile row generated_at unchanged); call the handler path
  for a synthetic YouTube chatter with zero history → assert the fixed welcome
  reply and no profile row; cleanup
- [x] 3.3 `npx openspec validate add-me-command --strict`
