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

- [ ] 0.1 Complete the R2 sections of
  `docs/superpowers/specs/2026-05-29-finishing-v1-setup-design.md`: bucket
  `vids-tube-vod`, API token, CORS rule, `cdn.vids.tube` custom domain.
- [ ] 0.2 Confirm the R2 round-trip: `doppler run -- npx tsx scripts/verify-r2.ts`
  PUTs and re-fetches an object via `NEXT_PUBLIC_VOD_BASE_URL` (200 + CORS
  headers). Do not start playback work until this passes.

## 1. Schema & RLS

- [ ] 1.1 `npx supabase migration new videos`; in it create `videos`:
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
- [ ] 1.2 Enable RLS. Policy: public SELECT `using (status = 'ready')`; NO client
  insert/update/delete (writes only via service-role ingest routes).
- [ ] 1.3 `npx supabase db push`; regenerate types:
  `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`.
- [ ] 1.4 Extend `supabase/rls-check.ts`: assert anon/auth can SELECT a `ready`
  video but NOT a `processing`/`failed` one; assert client INSERT/UPDATE on
  `videos` fails.

## 2. Secrets & dependency

- [ ] 2.1 Add Doppler secrets (per the setup doc) to `dev`/`stg`/`prd`:
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_VOD`, `NEXT_PUBLIC_VOD_BASE_URL`.
- [ ] 2.2 `npm install @aws-sdk/client-s3` (used only by the verification script,
  not app request paths).
- [ ] 2.3 `scripts/verify-r2.ts`: PUT a tiny object to `R2_BUCKET_VOD` via the S3
  endpoint, fetch it back through `NEXT_PUBLIC_VOD_BASE_URL`, assert 200 + body +
  CORS headers; throw on mismatch.

## 3. Ingest hooks (app ↔ VM)

- [ ] 3.1 Modify `app/api/ingest/offline/route.ts`: after setting the stream
  `ended`, insert a `videos` row (`status='processing'`, `source_stream_id`,
  `channel_id`, `title` from the stream) via the admin client. Idempotent: if a
  `videos` row already exists for that `source_stream_id`, do not duplicate.
- [ ] 3.2 `app/api/ingest/recording/route.ts` (`POST`, shared-secret guarded via
  `app/api/ingest/_shared.ts`): parse `{ streamId, mp4Path, thumbnailPath,
  durationS }`; update the matching `processing` `videos` row to `status='ready'`
  with those paths, `duration_s`, and `published_at = now()`. 401 on bad secret;
  404 if no matching processing row.

## 4. VOD playback page

- [ ] 4.1 `app/watch/[videoId]/page.types.ts`: `Video` type from `@/supabase/types`.
- [ ] 4.2 `app/watch/[videoId]/page.actions.ts`: `getVideoAction(videoId)` —
  server client, return the `ready` video or null (no auth required; RLS already
  hides non-ready rows).
- [ ] 4.3 `app/watch/[videoId]/page.hooks.tsx`: `useVideo(videoId)` query.
- [ ] 4.4 `app/watch/[videoId]/page.tsx`: full page immediately; inline skeleton on
  the player/title while loading; render a native `<video controls>` with
  `src = ${NEXT_PUBLIC_VOD_BASE_URL}/${video.mp4_path}` and the thumbnail as
  `poster`; show a "video not available" state when the query returns null.

## 5. Channel VOD listing

- [ ] 5.1 `app/[channelSlug]/page.actions.ts`: add `getChannelVideosAction(channelId)`
  returning `ready` videos newest-first (`published_at desc`).
- [ ] 5.2 `app/[channelSlug]/page.hooks.tsx`: add `useChannelVideos(channelId)`.
- [ ] 5.3 `components/video-card.tsx` (re-add, simplified): thumbnail + title +
  relative date, links to `/watch/<id>`. `components/video-grid.tsx`: responsive
  grid of cards with an inline skeleton grid while loading.
- [ ] 5.4 `app/[channelSlug]/page.tsx`: replace the "No videos yet." line with
  `VideoGrid`; keep that empty state only when the list is empty.

## 6. VM runbook — recording + upload

- [ ] 6.1 Extend `docs/runbooks/live-streaming-vm.md`: enable MediaMTX recording
  (`record: yes`, `recordPath`, `recordFormat: fmp4`) on the ingest path.
- [ ] 6.2 Document `rclone` setup for R2 (remote from `/etc/vids-tube/r2.env`:
  `R2_ACCOUNT_ID`/keys/endpoint), and the bucket/key scheme
  `vod/<slug>/<stream_id>.{mp4,jpg}`.
- [ ] 6.3 Document/author `finalize-vod.sh` invoked from `runOnNotReady` (after
  the existing offline-hook call): locate the session fMP4, `ffmpeg -c copy` →
  single MP4, extract a thumbnail at `min(10s, duration/2)`, `rclone copy` both to
  R2, then `POST /api/ingest/recording` with the `x-ingest-secret` header and the
  keys + duration. Log + exit non-zero on failure (leaves the row `processing`).
- [ ] 6.4 Document local retention (purge fMP4 on success; keep the MP4 ~7 days)
  and the manual re-run procedure for a stuck `processing` VOD.

## 7. Smoke test (VM — owner-run)

- [ ] 7.1 Push a short looping FFmpeg test file over RTMP; stop it; assert: the
  `streams` row flips `ended`, a `videos` row appears `processing` then `ready`,
  the MP4 + thumbnail exist in R2, and the watch page plays + seeks from
  `cdn.vids.tube`.

## 8. Verify

- [ ] 8.1 `npx tsc --noEmit`, `npm run lint`, `npm run build:local` all clean.
- [ ] 8.2 Run the extended RLS check (1.4) against the remote DB; all pass.
- [ ] 8.3 Extend Playwright specs: watch page plays a `ready` video and shows the
  unavailable state for a non-ready id; channel page lists VODs newest-first and
  shows the empty state with none. Run on request (user-run; no dev server here).
