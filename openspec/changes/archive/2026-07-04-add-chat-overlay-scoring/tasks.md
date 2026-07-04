## 1. Data model

- [x] 1.1 Create the migration with `npx supabase migration new add_chat_overlay_scoring` (do not hand-create the file)
- [x] 1.2 `featured_messages`: `id uuid pk default gen_random_uuid()`, `stream_id uuid not null references streams(id) on delete cascade`, `chat_message_id uuid not null unique references chat_messages(id) on delete cascade`, `user_id uuid not null references auth.users(id) on delete cascade`, `score int not null`, `categories text[] not null default '{}'`, `reason text`, `ring_level int not null default 1`, `featured_at timestamptz not null default now()`; index on `(stream_id, featured_at)`
- [x] 1.3 `viewer_scores`: pk `(stream_id, user_id)` (both FK as above, `on delete cascade`), `total_score int not null default 0`, `features_count int not null default 0`, `last_featured_at timestamptz`
- [x] 1.4 `score_events`: `id uuid pk`, `stream_id`, `user_id` (FK), `type text not null`, `points int not null default 0`, `metadata jsonb not null default '{}'`, `created_at timestamptz not null default now()`; index `(stream_id, user_id, created_at)`
- [x] 1.5 `chat_scoring_state`: `stream_id uuid pk references streams(id) on delete cascade`, `last_scored_at timestamptz`, `enabled boolean not null default false`, `locked_until timestamptz`, `updated_at timestamptz not null default now()`
- [x] 1.6 Enable RLS on all four; add `select using (true)` policies only (no insert/update policies → service-write only via the secret key, used by the external bot)
- [x] 1.7 `alter publication supabase_realtime add table public.featured_messages;`
- [x] 1.8 `npx supabase db push`, then `npm run db:types` to regenerate `supabase/types.ts`
- [x] 1.9 In `app/layout.types.ts` add `FeaturedMessage`, `ViewerScore`, `ScoreEvent`, `ChatScoringState` Row types and a `FeaturedMessageWithAuthor = FeaturedMessage & { author: AuthorIdentity }` type

## 2. OBS overlay route

- [x] 2.1 `app/(overlay)/layout.tsx`: transparent overlay layout (client component sets `<html>/<body>` background transparent on mount); site `<Nav>`/`<Toaster>` gated off for `/overlay/*` via `components/site-chrome.tsx` (single root layout retained to avoid moving every existing route into a group)
- [x] 2.2 `app/(overlay)/overlay/[channelSlug]/page.hooks.tsx`: `useFeaturedMessages(streamId)` mirroring `useLiveChat` (initial fetch + `postgres_changes` INSERT on `featured_messages`, channel `featured:${streamId}`, resolving author identity per row)
- [x] 2.3 `app/(overlay)/overlay/[channelSlug]/page.tsx`: resolve channel→live stream via `useChannel`+`useLiveStream`; plays featured messages one animation at a time (derived "first not-yet-played" row, advanced on animation end)
- [x] 2.4 `components/overlay/featured-avatar.tsx`: render the author avatar (`channelAssetUrl` + initials fallback) animating across screen via CSS keyframes, with `ring_level` concentric rings (stacked rounded elements separated by a gap); transparent background

## 3. Studio overlay control

- [x] 3.1 `app/studio/overlay/page.actions.ts`: `getOverlayContextAction()` (owner's current stream + `enabled`), `setScoringEnabledAction(streamId, enabled)` (owner-checked upsert), `getViewerLeaderboardAction(streamId)` (top N `viewer_scores` joined to identities via `resolveAuthorIdentities`)
- [x] 3.2 `app/studio/overlay/page.hooks.tsx`: `useOverlayContext`, `useSetScoringEnabled`, `useViewerLeaderboard`
- [x] 3.3 `app/studio/overlay/page.tsx`: guard with `useRequireOwner()`; render the scoring on/off toggle (writes `chat_scoring_state.enabled`, read by the external bot), the copyable OBS URL (`/overlay/<channelSlug>`), and a leaderboard of avatar + handle + ring count (reuse `AuthorChip`). No interval/scoring driver here. Sidebar link added in `components/studio-sidebar.tsx`.

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` and `npx eslint` pass for all new/changed files; `npm run build` compiles both new routes
- [x] 4.2 `scripts/verify-overlay-scoring.ts` (`doppler run -- tsx`) inserts `featured_messages` + `viewer_scores` + `chat_scoring_state` rows against a real stream/chat and confirms the anon client reads back exactly the rows the overlay and leaderboard consume (then cleans up). Live in-browser animation confirmation needs a `live` stream + browser — moved to AZ-118.
- [x] 4.3 Confirm RLS: `featured_messages`/`viewer_scores`/`score_events`/`chat_scoring_state` are publicly readable; inserts/updates without the secret key are denied (anon insert → error code `42501`)
- [x] 4.4 (deferred — needs a live stream + OBS) Browser animation + OBS-transparency confirmation tracked as **AZ-118** under the Vids.Tube project
