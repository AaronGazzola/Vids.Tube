## Context

Live streaming + chat shipped (`add-live-streaming-and-chat`): OBS → RTMP →
MediaMTX on a Hetzner VM → LL-HLS at `stream.vids.tube` (nginx TLS), with ingest
hooks (`/api/ingest/{auth,live,offline}`) flipping a `streams` row live/ended.
This change adds the recording + VOD layer on top, and is the first use of the
Cloudflare R2 + `cdn.vids.tube` storage/CDN path. External setup (R2 bucket,
custom-domain delegation, Stripe — Stripe unused here) is in
`docs/superpowers/specs/2026-05-29-finishing-v1-setup-design.md`.

## Goals / Non-Goals

**Goals:**
- Every ended stream becomes a free, seekable VOD with a thumbnail.
- Recording is remux-only (no transcode) — VM CPU stays near-idle, matching the
  live decision.
- VOD bytes are served from `cdn.vids.tube` (R2 + Cloudflare CDN, $0 egress).
- The `videos` model + lifecycle is multi-channel-ready.

**Non-Goals:**
- Credits / metering / Stripe on VOD (VOD is free, permanently — per the cost
  model).
- Comments, follow/subscribe (later slices).
- VOD title/description editing, deletion UI, visibility controls (later).
- Clip-from-stream / shorts, ABR ladder (v2).
- Moving *live* HLS to R2 (live stays direct-from-VM; see Decisions).

## Decisions

- **Record to fMP4, publish as a single MP4.** MediaMTX records the session as
  fMP4 segments (consistent with the LL-HLS muxer, remux-only). On stream end a
  finalize script concatenates them to one MP4 with `ffmpeg -c copy` (no
  re-encode) and uploads that. The watch page plays the MP4 directly via a
  native `<video>` element — range-request seekable over the CDN, no hls.js
  needed for VOD. Rationale: a single MP4 is the simplest robust artifact, fully
  seekable via HTTP range, and decouples VOD playback from the live player.
  *Alternative (serve an HLS VOD playlist from the fMP4 segments):* rejected for
  v1 — more moving parts (playlist generation, many small objects) for no
  single-rendition benefit; revisit if ABR lands in v2.

- **Two-phase publish via two hooks.** Recording finalize + upload takes time
  after the stream ends, so the VOD is created in two steps:
  1. The existing `runOnNotReady` → `/api/ingest/offline` hook (already sets the
     stream `ended`) **also** inserts a `videos` row with `status='processing'`
     and `source_stream_id`.
  2. After the finalize script finishes uploading the MP4 + thumbnail, it calls a
     new `/api/ingest/recording` hook (shared-secret guarded) with the stream id,
     the R2 object keys, and the duration; the app flips that row to
     `status='ready'` and stamps `published_at`.
  Rationale: viewers never see a half-uploaded VOD; a failed/aborted upload
  leaves the row `processing` (never surfaced publicly) rather than a broken
  `ready` row.

- **VOD object key scheme.** `vod/<channel_slug>/<stream_id>.mp4` and
  `vod/<channel_slug>/<stream_id>.jpg` in `R2_BUCKET_VOD`. The watch page builds
  the source as `${NEXT_PUBLIC_VOD_BASE_URL}/<mp4_path>`. Keys are stored on the
  `videos` row (`mp4_path`, `thumbnail_path`) so the base URL can change without
  a data migration.

- **Public read of ready VODs only.** `videos` RLS exposes `status='ready'` rows
  to everyone (VOD is public + free); `processing`/`failed` rows are invisible to
  clients. All writes happen server-side through the service-role ingest routes —
  no client INSERT/UPDATE/DELETE, matching the `streams` pattern.

- **Live stays direct-from-VM.** This change does not move live HLS to R2; only
  finalized recordings go to R2. The live `hls_path` abstraction is untouched.
  Rationale: live already works and meets latency goals; mixing live-segment
  upload into this slice adds risk for no v1 user benefit (it's a noted roadmap
  open question, deferred).

- **CDN caching + CORS.** VOD objects are immutable (keyed by stream id), so the
  custom domain can cache aggressively. The watch page uses a same-document
  `<video>` (no cross-origin fetch of media beyond standard range GETs); the R2
  CORS rule from the setup doc (`GET`/`HEAD` from `https://vids.tube`) covers it.

- **Conventions per CLAUDE.md.** Co-located `page.*`; actions validate
  `auth.getUser()` only where auth matters (VOD reads are public, so the listing
  + watch actions do not require a session); hooks use React Query; throw-on-error
  with `console.error`; no comments; `cn` from `@/lib/utils`; RLS on the new
  table; remote-only Supabase migrations via the CLI.

## Risks / Trade-offs

- [Finalize/upload fails → VOD stuck `processing`] → Acceptable: it's invisible
  to viewers. The finalize script logs + exits non-zero; re-run is manual in v1
  (a reconciliation job is a later concern). Document the manual re-run.
- [Long stream → large MP4 / long concat] → `-c copy` concat is I/O-bound, not
  CPU; fine at personal scale. Local disk must hold the session recording + the
  concatenated MP4 transiently (document retention/headroom in the runbook).
- [Single MP4 not adaptive] → Acceptable for v1 (single rendition, same as live);
  ABR + HLS-VOD is a v2 item.
- [R2/CDN misconfig serves nothing] → Covered by the `scripts/verify-r2.ts`
  round-trip from the setup doc, run before this slice's playback work.
- [Verification without a dev server] → App side via `tsc`/lint/`build:local`;
  the VM path via the documented record→upload→publish smoke test.

## Open Questions

- **Thumbnail frame:** fixed offset (default: 10s in, or midpoint for short
  streams) vs. a 3-up sprite. Default: single frame at `min(10s, duration/2)`.
- **Local retention on the VM:** how many days to keep the session fMP4 + MP4
  after a successful upload (default: purge the fMP4 immediately, keep the MP4
  for 7 days as a safety copy).
- **VOD of a crashed stream** (offline hook never fired, staleness guard ended
  it): does the finalize script run? Default: finalize is tied to
  `runOnNotReady`; a hard crash that skips it leaves no VOD — acceptable for v1,
  noted for a later reconciliation pass.
- **Upload tool on the VM:** `rclone` (simple config, good R2 support) vs.
  `aws-cli` (S3 endpoint). Default: `rclone`.
