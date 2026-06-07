## Why

vids.tube has auth, a `channels` table, and a fully navigable UI skeleton, but
nothing behind the placeholders works. This change delivers the first
*functional* slice of v1: the owner streams live from OBS, viewers watch for
free, and a live chat runs alongside — with a concurrent-viewer cap applied to
everyone (authenticated and anonymous alike). It proves the self-hosted
ingest → HLS → player pipeline end to end, deferring credits, payments, and VOD
to later slices. See `docs/superpowers/specs/2026-05-24-live-streaming-and-chat-design.md`.

## What Changes

- Add a **live ingest pipeline**: OBS pushes RTMP to a Hetzner VM running
  **MediaMTX**, authenticated by a per-channel stream key; MediaMTX **remuxes**
  (no transcode) to a single HLS rendition served over TLS by **Caddy** at
  `stream.vids.tube`.
- Add **MediaMTX → app hooks** (`/api/ingest/{auth,live,offline}`, shared-secret
  guarded) that authenticate publishing and flip the channel's stream
  live/ended.
- Add a **live HLS player** (hls.js) on the home and `/live` pages, with an
  offline "next stream" card when nothing is live.
- Add a **concurrent-viewer cap** (default 25, per-stream DB column) applied to
  auth + anon alike via Supabase Realtime **Presence** ("stream is full" wall),
  **hard-backstopped** by an edge max-connections limit so bandwidth stays
  bounded even if the app cap is bypassed.
- Add **live chat** via Supabase Realtime: anonymous viewers read; signed-in
  users post; messages persist to `chat_messages`.
- Add a **Studio "Go live" page**: shows the RTMP URL + stream key and allows
  **key regeneration**; reflects current live status.
- **Remove/trim UI** not needed for this slice: delete credits, VOD watch/grid,
  Studio upload/videos; trim home to the live area; repurpose the sign-in wall as
  the "stream full" wall; reduce Studio to Go live + minimal Settings.
- Add an **infra runbook** for provisioning the VM (MediaMTX, Caddy TLS + edge
  cap, DNS, firewall, OBS, pipeline smoke test).

## Capabilities

### New Capabilities
- `stream-pipeline`: stream-key storage + regeneration, RTMP publish auth, live/
  offline state hooks, HLS remux delivery, edge concurrency cap, staleness guard.
- `live-playback`: the hls.js live player and offline state on the home and
  `/live` pages.
- `viewer-cap`: the per-stream concurrent cap applied to all viewers via Realtime
  Presence, backstopped by the edge cap.
- `live-chat`: real-time chat with anonymous read and authenticated posting.

### Modified Capabilities
<!-- The prior `add-v1-ui-skeleton` capabilities (viewer-pages, studio, app-shell)
     have not been archived to openspec/specs/, so they have no baseline to delta
     against. The UI removal/trim is captured under Impact and Tasks rather than
     as spec deltas. -->

## Impact

- **Schema:** new `streams`, `stream_keys`, and `chat_messages` tables (all with
  RLS); generated types regenerated. No change to `channels`.
- **App code:** `/api/ingest/*` route handlers; a live player component + hook; a
  presence-cap hook + "stream full" wall; a chat component + hook; an owner-only
  stream-key server action; the Studio Go live page.
- **Removed code:** `/credits`, `credits-badge`, credits store; `/watch/[videoId]`
  + VOD components (`video-card`, `video-grid`, `stream-history-item`,
  `view-chart`); Studio `/upload` + `/videos`; placeholder components
  (`player-placeholder`, `live-chat-placeholder`, `coming-soon`).
- **New dependency:** `hls.js`.
- **New secrets (Doppler):** an ingest shared secret; the stream host base URL.
- **Infra:** a Hetzner VM provisioned per the runbook (owner-run; verified by the
  documented RTMP smoke test). App tasks remain verifiable via `tsc` / lint /
  `npm run build:local`.
