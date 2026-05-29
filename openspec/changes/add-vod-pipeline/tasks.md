# Tasks: add-vod-pipeline

> Follow `CLAUDE.md` + `docs/template_files/`. No comments; throw-on-error
> (`console.error`); `cn` from `@/lib/utils`; co-located `page.*`; Zustand for
> client state; React Query hooks call actions; browser client for auth/realtime;
> admin client only server-side. No middleware. Remote-only Supabase: create
> migrations with `npx supabase migration new <name>` (never hand-write
> filenames), push with `npx supabase db push`, regenerate types after. Verify
> with `npx tsc --noEmit` / `npm run lint` / `npm run build:local` — do NOT start
> a dev server. RLS on every new table.

## 0. Prerequisite: external setup

- [x] 0.1 Complete the R2 sections of
  `docs/superpowers/specs/2026-05-29-finishing-v1-setup-design.md`: bucket
  `vids-tube-vod`, API token, CORS rule, `cdn.vids.tube` custom domain.
  (Done 2026-05-29; `cdn.vids.tube` serves over HTTPS with CORS verified.)
- [x] 0.2 Confirm the R2 round-trip: `doppler run -- npx tsx scripts/verify-r2.ts`
  PUTs and re-fetches an object via `NEXT_PUBLIC_VOD_BASE_URL` (200 + CORS
  headers). All checks PASS.

## 1. Schema & RLS

- [x] 1.1 `npx supabase migration new videos`; in it create `videos`:
  - `id` uuid pk default `gen_random_uuid()`
  - `channel_id` uuid not null fk → `channels (id)` on delete cascade
  - `source_stream_id` uuid fk → `streams (id)` on delete set null (nullable)
  - `status` text not null default `processing` check in (`processing`,`ready`,`failed`)
  - `title` text
  - `mp4_path` text
  - `thumbnail_path` text
  - `duration_s` integer
  - `published_at` timestamptz
  - `created_at` timestamptz not null default now()
  - indexes: `(channel_id, published_at desc)`, `(source_stream_id)`
- [x] 1.2 Enable RLS. Policy: public SELECT `using (status = 'ready')`; NO client
  insert/update/delete (writes only via service-role ingest routes).
- [x] 1.3 `npx supabase db push`; regenerate types (`npm run db:types`).
- [x] 1.4 Extend `supabase/rls-check.ts`: assert anon/auth can SELECT a `ready`
  video but NOT a `processing`/`failed` one; assert client INSERT/UPDATE on
  `videos` fails. (All assertions PASS.)

## 2. Secrets & dependency

- [x] 2.1 Add Doppler secrets (per the setup doc) to `dev`/`stg`/`prd`:
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_VOD`, `NEXT_PUBLIC_VOD_BASE_URL`. (Present in `dev` + `prd`.)
- [x] 2.2 `npm install @aws-sdk/client-s3` (used only by the verification script,
  not app request paths).
- [x] 2.3 `scripts/verify-r2.ts`: PUT a tiny object to `R2_BUCKET_VOD` via the S3
  endpoint, fetch it back through `NEXT_PUBLIC_VOD_BASE_URL`, assert 200 + body +
  CORS headers; throw on mismatch.

## 3. Ingest hooks (app ↔ VM)

- [x] 3.1 Modify `app/api/ingest/offline/route.ts`: after setting the stream
  `ended`, insert a `videos` row (`status='processing'`, `source_stream_id`,
  `channel_id`, `title` from the stream) via the admin client. Idempotent: if a
  `videos` row already exists for that `source_stream_id`, do not duplicate.
- [x] 3.2 `app/api/ingest/recording/route.ts` (`POST`, shared-secret guarded via
  `app/api/ingest/_shared.ts`): identified by `?path=<slug>` (the VM never knows
  the DB stream uuid — consistent with the other ingest hooks); parse
  `{ mp4Path, thumbnailPath, durationS }`; update that channel's latest
  `processing` `videos` row to `status='ready'` with those paths, `duration_s`,
  and `published_at = now()`. 403 on bad secret; 404 if no matching processing
  row.

## 4. VOD playback page

- [x] 4.1 `app/watch/[videoId]/page.types.ts`: `Video` type from `@/supabase/types`.
- [x] 4.2 `app/watch/[videoId]/page.actions.ts`: `getVideoAction(videoId)` —
  server client, return the `ready` video or null (no auth required; RLS already
  hides non-ready rows; malformed (non-uuid) ids return null).
- [x] 4.3 `app/watch/[videoId]/page.hooks.tsx`: `useVideo(videoId)` query.
- [x] 4.4 `app/watch/[videoId]/page.tsx`: full page immediately; inline skeleton on
  the player/title while loading; render a native `<video controls>` with
  `src = ${NEXT_PUBLIC_VOD_BASE_URL}/${video.mp4_path}` and the thumbnail as
  `poster`; show a "video not available" state when the query returns null.

## 5. Channel VOD listing

- [x] 5.1 `app/[channelSlug]/page.actions.ts`: add `getChannelVideosAction(channelId)`
  returning `ready` videos newest-first (`published_at desc`).
- [x] 5.2 `app/[channelSlug]/page.hooks.tsx`: add `useChannelVideos(channelId)`.
- [x] 5.3 `components/video-card.tsx` (re-add, simplified): thumbnail + title +
  date, links to `/watch/<id>`. `components/video-grid.tsx`: responsive
  grid of cards with an inline skeleton grid while loading.
- [x] 5.4 `app/[channelSlug]/page.tsx`: replace the "No videos yet." line with
  `VideoGrid`; the empty state now lives inside `VideoGrid` (shown when the list
  is empty).

## 6. VM runbook — recording + upload

- [x] 6.1 Extend `docs/runbooks/live-streaming-vm.md` §3: enable MediaMTX
  recording (`record: yes`, `recordPath`, `recordFormat: fmp4`,
  `recordSegmentDuration: 24h` so a session is one file) on the ingest path.
- [x] 6.2 Document `rclone` setup for R2 (§8.1–8.2; remote from
  `/etc/vids-tube/r2.env`), and the key scheme `vod/<slug>/<ts>.{mp4,jpg}`
  (timestamp generated by the VM — it cannot know the DB stream uuid).
- [x] 6.3 Author `mtx-finalize-vod.sh` (§8.3) launched from `runOnNotReady` (after
  the offline-hook call): locate the session fMP4, `ffmpeg -c copy +faststart` →
  single MP4, thumbnail at `min(10s, duration/2)`, `rclone copyto` both to R2,
  then `POST /api/ingest/recording?path=<slug>` with the `x-ingest-secret` header
  and the keys + duration. Logs + exits non-zero on failure (row stays
  `processing`).
- [x] 6.4 Document local retention (§8.4; purge fMP4 on success, keep MP4 ~7 days)
  and the manual re-run procedure for a stuck `processing` VOD.

## 7. Smoke test (VM — owner-run)

- [ ] 7.1 Push a short looping FFmpeg test file over RTMP; stop it; assert: the
  `streams` row flips `ended`, a `videos` row appears `processing` then `ready`,
  the MP4 + thumbnail exist in R2, and the watch page plays + seeks from
  `cdn.vids.tube`. (Documented in runbook §8.5; owner-run on the VM.)

## 8. Verify

- [x] 8.1 `npx tsc --noEmit` clean; `npm run build:local` passes. `npm run lint`
  has one non-blocking `no-img-element` warning on `video-card.tsx` — intentional
  (`next/image` would route thumbnails through Vercel's optimizer, defeating R2's
  $0 egress; a plain `<img>` from `cdn.vids.tube` is correct).
- [x] 8.2 Run the extended RLS check (1.4) against the remote DB; all pass.
- [x] 8.3 Extend Playwright specs (`tests/e2e/vod.spec.ts`): watch page renders the
  player for a `ready` video and shows the unavailable state for a non-ready id;
  channel page lists VODs newest-first and shows the empty state with none
  (self-contained — creates/cleans up its own throwaway channels). Run on request
  (user-run; no dev server started here).
