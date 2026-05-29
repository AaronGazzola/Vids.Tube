## Why

vids.tube can stream live, but the moment a stream ends it's gone — nothing is
recorded or watchable afterward. This change delivers the next functional slice
of v1: **every completed live stream is automatically recorded, uploaded to
Cloudflare R2, and published as a free-to-watch VOD** on the channel page. It is
the first slice to exercise the R2 + `cdn.vids.tube` storage/CDN path the
platform's cost model depends on ($0 egress, storage-only cost). Credits,
comments, and follow remain later slices. See
`docs/superpowers/specs/2026-05-29-finishing-v1-setup-design.md` (external setup)
and the "Finishing v1 — plan" section of
`docs/superpowers/specs/2026-05-23-vids-tube-roadmap.md`.

## What Changes

- Add **stream recording on the VM**: MediaMTX records each session to fMP4
  segments (remux, no transcode), alongside the existing live HLS.
- Add a **finalize-and-upload step** on stream end: a VM script remuxes the
  session recording to a single seekable MP4 (`-c copy`), extracts a poster
  thumbnail, uploads both to the R2 VOD bucket, and notifies the app.
- Add a **`videos` table** (multi-channel-ready, RLS) representing published
  VODs, plus a new **recording-complete ingest hook**
  (`/api/ingest/recording`, shared-secret guarded) that flips the VOD from
  `processing` to `ready`.
- Extend the existing **`/api/ingest/offline`** hook to create the `processing`
  `videos` row when a stream ends.
- Add **free VOD playback**: re-introduce a `/watch/[videoId]` page that plays
  the MP4 directly from `cdn.vids.tube` (native `<video>`, range-seekable) — no
  playback token, no credit cost, no viewer cap.
- Add a **VOD listing** on the channel page: published videos newest-first with
  thumbnails, replacing the current "No videos yet" placeholder.
- Add an **R2 dependency + secrets** and extend the **VM runbook** with the
  recording config, the finalize script, and the R2 upload setup.

## Capabilities

### New Capabilities
- `vod-recording`: VM session recording → finalize/remux to MP4 + thumbnail →
  R2 upload → the `videos` lifecycle (`processing` → `ready` / `failed`) driven
  by the offline + recording-complete ingest hooks.
- `vod-playback`: free public playback of a ready VOD from the CDN, and the
  channel-page VOD listing.

### Modified Capabilities
- `stream-pipeline` (from `add-live-streaming-and-chat`): the `offline` ingest
  hook gains the side effect of creating the `processing` VOD row. The live HLS
  delivery path is unchanged.

## Impact

- **Schema:** new `videos` table (RLS: public SELECT of `ready` rows only;
  writes service-role-only); generated types regenerated. No change to
  `streams`/`channels`.
- **App code:** new `/api/ingest/recording` route; modified
  `/api/ingest/offline` route; re-added `app/watch/[videoId]/` page + actions +
  hooks + types; channel page VOD listing (actions/hooks extended); a
  `components/video-card.tsx` + `video-grid.tsx` (re-added, simplified).
- **New dependency:** an S3-compatible client for the verification script
  (`@aws-sdk/client-s3`); the VM uses `rclone`/`aws-cli` (not an app dep).
- **New secrets (Doppler):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_VOD`, `NEXT_PUBLIC_VOD_BASE_URL` (per the
  setup design doc).
- **Infra:** R2 bucket + `cdn.vids.tube` custom domain (owner-provisioned per
  the setup doc); VM gains MediaMTX recording + a finalize/upload script. App
  tasks remain verifiable via `tsc` / lint / `npm run build:local`; the VM path
  via the documented record→upload→publish smoke test.
