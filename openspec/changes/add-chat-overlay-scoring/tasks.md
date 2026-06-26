## 1. Data model

- [ ] 1.1 Create the migration with `npx supabase migration new add_chat_overlay_scoring` (do not hand-create the file)
- [ ] 1.2 `featured_messages`: `id uuid pk default gen_random_uuid()`, `stream_id uuid not null references streams(id) on delete cascade`, `chat_message_id uuid not null unique references chat_messages(id) on delete cascade`, `user_id uuid not null references auth.users(id) on delete cascade`, `score int not null`, `categories text[] not null default '{}'`, `reason text`, `ring_level int not null default 1`, `featured_at timestamptz not null default now()`; index on `(stream_id, featured_at)`
- [ ] 1.3 `viewer_scores`: pk `(stream_id, user_id)` (both FK as above, `on delete cascade`), `total_score int not null default 0`, `features_count int not null default 0`, `last_featured_at timestamptz`
- [ ] 1.4 `score_events`: `id uuid pk`, `stream_id`, `user_id` (FK), `type text not null`, `points int not null default 0`, `metadata jsonb not null default '{}'`, `created_at timestamptz not null default now()`; index `(stream_id, user_id, created_at)`
- [ ] 1.5 `chat_scoring_state`: `stream_id uuid pk references streams(id) on delete cascade`, `last_scored_at timestamptz`, `enabled boolean not null default false`, `locked_until timestamptz`, `updated_at timestamptz not null default now()`
- [ ] 1.6 Enable RLS on all four; add `select using (true)` policies only (no insert/update policies → service-write only via the secret key, used by the external bot)
- [ ] 1.7 `alter publication supabase_realtime add table public.featured_messages;`
- [ ] 1.8 `npx supabase db push`, then `npm run db:types` to regenerate `supabase/types.ts`
- [ ] 1.9 In `app/layout.types.ts` add `FeaturedMessage`, `ViewerScore`, `ScoreEvent`, `ChatScoringState` Row types and a `FeaturedMessageWithAuthor = FeaturedMessage & { author: AuthorIdentity }` type

## 2. OBS overlay route

- [ ] 2.1 `app/(overlay)/layout.tsx`: own `<html>/<body className="bg-transparent">`, wrap `<Providers>` only (no `<Nav>`/`<Toaster>`)
- [ ] 2.2 `app/(overlay)/overlay/[channelSlug]/page.hooks.tsx`: `useFeaturedMessages(streamId)` mirroring `useLiveChat` (initial fetch + `postgres_changes` INSERT on `featured_messages`, channel `featured:${streamId}`, resolving author identity per row)
- [ ] 2.3 `app/(overlay)/overlay/[channelSlug]/page.tsx`: resolve channel→live stream via `useChannel`+`useLiveStream`; feed featured messages into a queue that plays one animation at a time
- [ ] 2.4 `components/overlay/featured-avatar.tsx`: render the author avatar (`channelAssetUrl` + initials fallback) animating across screen via CSS keyframes, with `ring_level` concentric rings (stacked rounded elements separated by a gap); transparent background

## 3. Studio overlay control

- [ ] 3.1 `app/studio/overlay/page.actions.ts`: `getScoringStateAction(streamId)`, `setScoringEnabledAction(streamId, enabled)` (owner-checked), `getViewerLeaderboardAction(streamId)` (top N `viewer_scores` joined to identities via `resolveAuthorIdentities`)
- [ ] 3.2 `app/studio/overlay/page.hooks.tsx`: `useScoringState`, `useSetScoringEnabled`, `useViewerLeaderboard`
- [ ] 3.3 `app/studio/overlay/page.tsx`: guard with `useRequireOwner()`; render the scoring on/off toggle (writes `chat_scoring_state.enabled`, read by the external bot), the copyable OBS URL (`/overlay/<channelSlug>`), and a leaderboard of avatar + handle + ring count (reuse `AuthorChip`). No interval/scoring driver here.

## 4. Verification

- [ ] 4.1 `npx tsc --noEmit` and `npx eslint` pass for all new/changed files
- [ ] 4.2 Manually insert a few `featured_messages` rows (with increasing `ring_level`) and an `enabled` `chat_scoring_state` row via a `doppler run -- tsx` script (not psql); confirm `/overlay/<channelSlug>` animates the author avatar across with the matching ring count, and the studio leaderboard reflects `viewer_scores`
- [ ] 4.3 Confirm RLS: `featured_messages`/`viewer_scores`/`score_events`/`chat_scoring_state` are publicly readable; inserts/updates without the secret key are denied
- [ ] 4.4 (deferred — needs OBS; tracked as a Linear verification issue) Confirm `/overlay/<channelSlug>` is transparent in an OBS Browser Source
