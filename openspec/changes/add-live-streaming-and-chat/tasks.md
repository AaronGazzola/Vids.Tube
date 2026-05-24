# Tasks: add-live-streaming-and-chat

> Follow `CLAUDE.md` + `docs/template_files/`. No comments; throw-on-error
> (`console.error`); `cn` from `@/lib/utils`; co-located `page.*`; Zustand for
> client state; React Query hooks call actions; browser client for auth/realtime;
> admin client only server-side. No middleware. Remote-only Supabase: create
> migrations with `npx supabase migration new <name>` (never hand-write
> filenames), push with `npx supabase db push`, regenerate types after. Verify
> with `npx tsc --noEmit` / `npm run lint` / `npm run build:local` — do NOT start
> a dev server. RLS on every new table.

## 1. Schema & RLS

- [ ] 1.1 `npx supabase migration new streams_stream_keys_chat`; in it create:
  - `streams` (`id` uuid pk, `channel_id` fk → channels, `status` text check in (`idle`,`live`,`ended`) default `idle`, `title` text, `hls_path` text, `max_viewers` int not null default 25, `started_at` timestamptz, `ended_at` timestamptz, `last_seen_at` timestamptz, `created_at` timestamptz default now())
  - `stream_keys` (`channel_id` uuid pk fk → channels, `key` text not null, `created_at` timestamptz default now())
  - `chat_messages` (`id` uuid pk default gen_random_uuid(), `stream_id` fk → streams, `user_id` uuid fk → auth.users, `body` text not null, `created_at` timestamptz default now())
- [ ] 1.2 Enable RLS on all three. Policies:
  - `streams`: public SELECT (`using (true)`); NO client insert/update/delete (writes only via service-role ingest routes)
  - `stream_keys`: owner-only SELECT + UPDATE via `exists (select 1 from channels c where c.id = channel_id and c.owner_user_id = (select auth.uid()))`; no public access
  - `chat_messages`: public SELECT; INSERT for `authenticated` with `check (user_id = (select auth.uid()))`
- [ ] 1.3 Enable Realtime on `chat_messages` (add to `supabase_realtime` publication).
- [ ] 1.4 `npx supabase db push`; then regenerate types: `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`.
- [ ] 1.5 Seed a `stream_keys` row + an `idle` `streams` row for the owner channel in `supabase/seed.ts`; run the seed.
- [ ] 1.6 Extend `supabase/rls-check.ts`: assert anon can SELECT `streams`/`chat_messages` but NOT `stream_keys`; assert authenticated chat insert as self succeeds and as another user fails.

## 2. Secrets & dependency

- [ ] 2.1 Add Doppler secrets: `INGEST_SHARED_SECRET` (server), `NEXT_PUBLIC_STREAM_HOST` (e.g. `https://stream.vids.tube`). Document in `docs/` / memory reference.
- [ ] 2.2 `npm install hls.js` (+ `@types/hls.js` if needed).

## 3. Ingest hook routes (app ↔ MediaMTX)

- [ ] 3.1 `app/api/ingest/_shared.ts`: a helper that reads the shared-secret header and throws/401s when absent or wrong; an admin-client accessor.
- [ ] 3.2 `app/api/ingest/auth/route.ts` (`POST`): parse MediaMTX auth payload, look up the presented stream key in `stream_keys` via the admin client, return 200 on match else 401. No session needed (MediaMTX → server).
- [ ] 3.3 `app/api/ingest/live/route.ts` (`POST`): shared-secret guarded; upsert the channel's `streams` row to `status='live'`, set `started_at`, `hls_path` (from `NEXT_PUBLIC_STREAM_HOST` + channel path), stamp `last_seen_at`.
- [ ] 3.4 `app/api/ingest/offline/route.ts` (`POST`): shared-secret guarded; set the channel's live `streams` row to `status='ended'`, `ended_at=now()`.

## 4. Stream key management (Studio Go live)

- [ ] 4.1 `app/studio/live/page.actions.ts`: `getStreamKeyAction` (validate `auth.getUser()` + channel ownership, return key) and `regenerateStreamKeyAction` (ownership-checked update with a freshly generated key).
- [ ] 4.2 `app/studio/live/page.hooks.tsx`: `useStreamKey` (query) + `useRegenerateStreamKey` (mutation, invalidates the query, success toast).
- [ ] 4.3 Rebuild `app/studio/live/page.tsx`: show RTMP URL (`rtmp://<stream-host>/<channel>`), the stream key (shadcn `input` read-only + copy), a **Regenerate** button (shadcn `alert-dialog` confirm), and current live status from a `streams` query. Inline skeleton on the key while loading.

## 5. Live state + player

- [ ] 5.1 `app/layout.actions.ts` (or a `live` page action): `getLiveStreamAction(channelId)` returning the current stream treating `live` + stale `last_seen_at` (> 60s) as offline.
- [ ] 5.2 `components/live-player.tsx`: client component using `hls.js` (native HLS fallback for Safari), pointed at `hls_path`, with retry on transient playlist errors; cleanup on unmount.
- [ ] 5.3 Wire `app/live/page.tsx`: query live stream; if offline show the offline "next stream" card; if live, gate on the viewer cap (Phase 6) then render `LivePlayer`. Remove `PlayerPlaceholder` usage.
- [ ] 5.4 Wire `app/page.tsx` home live area to the same live-stream query + player; keep the offline card.

## 6. Viewer cap (presence)

- [ ] 6.1 `app/live/page.hooks.tsx` (+ home): `useViewerCap(streamId, maxViewers)` — joins a Supabase Realtime Presence channel keyed to the stream via the browser client; computes deterministic rank by join order; returns `admitted | full | connecting`.
- [ ] 6.2 Repurpose `components/sign-in-wall.tsx` → `components/stream-full-wall.tsx` (shadcn `card`): "Stream is full — try again shortly." Applies to auth + anon alike.
- [ ] 6.3 In `/live` and home: render `LivePlayer` only when admitted; show `StreamFullWall` when full; inline skeleton while connecting.

## 7. Live chat

- [ ] 7.1 `app/live/page.types.ts`: `ChatMessage` from `@/supabase/types`.
- [ ] 7.2 `app/live/page.actions.ts`: `getChatMessagesAction(streamId)` (recent history) and `postChatMessageAction(streamId, body)` (validate `auth.getUser()`, insert as self).
- [ ] 7.3 `app/live/page.hooks.tsx`: `useLiveChat(streamId)` — initial history via query; subscribe to `chat_messages` INSERTs via the browser client Realtime channel; `usePostChatMessage` mutation.
- [ ] 7.4 `components/live-chat.tsx` (replaces `live-chat-placeholder.tsx`): message list (auto-scroll) + composer; for anonymous users replace the composer with a "sign in to chat" prompt. Wire into `/live` and home.

## 8. UI removal / trim

- [ ] 8.1 Delete `/credits`: `app/credits/`, `components/credits-badge.tsx`, and the credits slice in `app/layout.stores.ts`; remove `CreditsBadge` from `components/nav.tsx`.
- [ ] 8.2 Delete VOD UI: `app/watch/[videoId]/`, `components/video-card.tsx`, `components/video-grid.tsx`, `components/stream-history-item.tsx`, `components/view-chart.tsx`.
- [ ] 8.3 Delete Studio VOD tools: `app/studio/upload/`, `app/studio/videos/`; remove their links from `components/studio-sidebar.tsx` and any `app/studio/page.tsx` cards.
- [ ] 8.4 Trim `app/page.tsx`: remove the "Past streams" stream-history section and the "Watch latest VOD" button from `components/next-stream-card.tsx`; keep the live player + chat + offline card.
- [ ] 8.5 Delete now-unused placeholders: `components/player-placeholder.tsx`, `components/live-chat-placeholder.tsx`, `components/coming-soon.tsx` (and `empty-state.tsx` if unused). Confirm no remaining imports.

## 9. VM runbook (infra — owner-provisioned)

- [ ] 9.1 Write `docs/runbooks/live-streaming-vm.md`: MediaMTX install + config (RTMP ingest path; external HTTP auth → `/api/ingest/auth`; `runOnReady` → `/api/ingest/live`; `runOnNotReady` → `/api/ingest/offline`; all with the `INGEST_SHARED_SECRET` header; HLS muxer settings).
- [ ] 9.2 Document Caddy: TLS for `stream.vids.tube`, reverse proxy to the MediaMTX HLS endpoint, and the hard `max-connections` edge cap (e.g. 30).
- [ ] 9.3 Document DNS (`stream.vids.tube` → VM), firewall (restrict RTMP ingest port; open 80/443 for HLS), and OBS settings (server URL, stream key, 720p output).
- [ ] 9.4 Document the pipeline smoke test: push a looping FFmpeg test file over RTMP → assert the `streams` row flips to `live` and the player plays → stop → assert it flips to `ended`.

## 10. Verify

- [ ] 10.1 `npx tsc --noEmit`, `npm run lint`, `npm run build:local` all clean; fix issues.
- [ ] 10.2 Run the RLS check script (Phase 1.6) against the remote DB; all assertions pass.
- [ ] 10.3 Extend Playwright specs: offline card with no live stream; player mounts when a live `streams` row exists; "stream full" wall when presence is simulated past `max_viewers`; chat composer hidden for anon and functional for auth. Run on request (user-run; no dev server started here).
