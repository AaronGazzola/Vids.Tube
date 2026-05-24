# vids.tube — Live Streaming + Live Chat Design Spec

**Date:** 2026-05-24
**Status:** Approved (design); pending OpenSpec change
**Related:** [Roadmap](./2026-05-23-vids-tube-roadmap.md) · [v1 Design](./2026-05-23-vids-tube-v1-design.md)

## Purpose

Ship the first *functional* slice of v1: the owner streams live from OBS, viewers
watch for free, and a live chat runs alongside — with a concurrent-viewer cap
applied to everyone (authenticated and anonymous alike). This proves the
self-hosted ingest → HLS → player pipeline end to end, without the credit,
payment, or VOD machinery, which arrive in later slices.

## Scope

### In scope
- **Live ingest:** owner pushes RTMP from OBS to a Hetzner VM (authenticated by a
  secret stream key).
- **HLS delivery:** MediaMTX remuxes the incoming H.264/AAC to a single HLS
  rendition (no transcode) served over TLS at `stream.vids.tube`.
- **Live state:** MediaMTX hooks tell the app when a stream goes live/offline.
- **Playback:** hls.js player on the home and `/live` pages; offline state shows a
  "next stream" card.
- **Concurrent-viewer cap:** a per-stream cap (default 25) applied to auth + anon
  alike. Enforced softly in the app (Realtime Presence "stream full" wall) **and**
  hard-capped at the edge (Caddy/MediaMTX max-connections) to bound bandwidth.
- **Live chat:** Supabase Realtime; anonymous viewers read, signed-in users post.
- **Studio "Go live" page:** shows the RTMP URL + stream key, allows key
  regeneration, and reflects current live status.
- **Single channel** (the owner's), with a multi-channel-ready data model.

### Out of scope (deferred)
- Credits, per-minute metering, Stripe top-ups.
- VOD recording, publication, and playback.
- Adaptive bitrate ladder / server-side transcode (v2; deferring transcode now
  costs nothing since ABR is already a v2 item).
- Low-latency HLS.
- Comments on VODs, follow/subscribe.
- A hard token-gated segment proxy (the edge connection cap covers the cost
  concern without it).

## Architecture

```
OBS ──RTMP(stream key)──► Hetzner VM
                          │ MediaMTX: RTMP ingest + auth hook + HLS remux
                          │   ├─ publish-auth ─► POST /api/ingest/auth    (validate key)
                          │   ├─ on-ready ─────► POST /api/ingest/live     (stream → live)
                          │   └─ on-notready ──► POST /api/ingest/offline  (stream → ended)
                          │ Caddy: TLS @ stream.vids.tube + max-connections cap
                          └─ HLS: https://stream.vids.tube/<path>/index.m3u8
                                       │
Viewer ◄── hls.js ◄────────────────────┘
   │  presence (cap) + chat via Supabase Realtime
   ▼
Next.js (App Router) ──► Supabase (Postgres + Auth + Realtime)
```

OBS is configured to output 720p; MediaMTX **remuxes** (repackages) RTMP into HLS
with no re-encoding, so VM CPU stays near-idle and a small/cheap instance
suffices. Caddy terminates TLS in front of MediaMTX and enforces a hard
maximum-concurrent-connection limit on the HLS endpoint. No R2/CDN in this slice;
HLS is served directly from the VM.

### Components

1. **Hetzner VM (infra, provisioned by the owner via the runbook below).**
   - **MediaMTX** — accepts RTMP from OBS, authenticated by stream key via an
     external HTTP auth hook; remuxes to HLS; fires ready/not-ready hooks.
   - **Caddy** — TLS for `stream.vids.tube`; reverse-proxies the MediaMTX HLS
     endpoint; enforces a hard max-connections cap (e.g. 30) as the bandwidth
     backstop.

2. **Next.js app.**
   - **Ingest hook routes** (`/api/ingest/{auth,live,offline}`) — called by
     MediaMTX, guarded by a shared secret header.
   - **Live player** — hls.js, renders when a stream is live.
   - **Viewer cap** — Supabase Realtime Presence per stream.
   - **Live chat** — Supabase Realtime subscription + insert.
   - **Studio "Go live" page** — stream key display/regeneration + live status.

3. **Supabase.** Postgres (streams, stream_keys, chat_messages); Auth (existing);
   Realtime (chat + presence).

## Data model (Postgres, multi-channel-ready)

New tables (`channels` already exists from the foundation slice):

- **`streams`** — `id`, `channel_id` (fk), `status` (`idle` | `live` | `ended`),
  `title`, `hls_path`, `max_viewers` (int, default 25), `started_at`, `ended_at`,
  `last_seen_at`, `created_at`.
  RLS: **public read**; inserts/updates only via the service-role ingest hooks
  (no client write policy).

- **`stream_keys`** — `channel_id` (pk, fk), `key` (text, secret), `created_at`.
  A **separate table** so the wide-open public `channels` SELECT cannot leak the
  secret. RLS: **owner-only** SELECT/UPDATE (`channel.owner_user_id = auth.uid()`);
  no public access. MediaMTX auth validation reads it with the **admin client**
  (service role), never the browser.

- **`chat_messages`** — `id`, `stream_id` (fk), `user_id` (fk auth.users), `body`
  (text), `created_at`.
  RLS: **public read** (anonymous viewers see chat); **insert** restricted to
  `authenticated` where `user_id = auth.uid()`.

All three tables have RLS enabled. `streams` and `chat_messages` are exposed to
the Data API; `stream_keys` is reachable only through owner-scoped policies and
the admin client.

## Key flows

### Go live
1. Owner configures OBS to push to `rtmp://stream.vids.tube/<channel-path>` with
   the secret stream key.
2. MediaMTX receives the publish attempt and calls `POST /api/ingest/auth` (with
   the shared-secret header). The route looks up the key in `stream_keys` via the
   admin client; on match it returns 200 (publish allowed), else 401.
3. MediaMTX fires `runOnReady` → `POST /api/ingest/live`. The route upserts the
   channel's `streams` row to `status = live`, sets `started_at`, `hls_path`, and
   stamps `last_seen_at`.
4. MediaMTX remuxes to HLS; Caddy serves it over TLS.

### Watch
1. A viewer opens the home or `/live` page. The app queries `streams` for the
   channel's current row.
2. **Not live** → render the offline "next stream" card (no player, no presence).
3. **Live** → the client joins a Supabase Realtime **Presence** channel keyed to
   the stream id. On presence sync, the client computes its rank among present
   members; if rank < `max_viewers` it mounts the hls.js player pointed at
   `hls_path`, otherwise it leaves presence and shows the **"Stream is full"**
   wall. The cap applies identically to authenticated and anonymous viewers.
4. The chat panel subscribes to `chat_messages` for the stream and renders
   messages in real time. Anonymous users see a "sign in to chat" prompt in place
   of the composer; signed-in users post (insert), which broadcasts via Realtime.

### End
1. OBS stops publishing → MediaMTX fires `runOnNotReady` → `POST /api/ingest/offline`
   → the route sets the `streams` row to `status = ended`, `ended_at = now()`.
2. The player detects stream end (HLS ends / status poll) and returns to the
   offline card.
3. **Staleness guard:** the live/offline hooks stamp `last_seen_at`. A stream that
   is `live` but whose `last_seen_at` is older than ~60s is treated as offline by
   read queries, covering the case where MediaMTX crashes without firing the
   offline hook.

### Regenerate stream key
1. Owner opens the Studio "Go live" page.
2. An owner-checked server action (validates `auth.getUser()` ownership of the
   channel) reads or rotates the `stream_keys.key`. Regeneration overwrites the
   key; the owner re-pastes it into OBS.

## Cost containment

The dominant cost is the **flat-fee Hetzner VM**, which does not scale with viewer
count — there is no managed per-viewer service in the path, so no runaway-bill
mechanism. The only variable is VM egress bandwidth, bounded three ways:

- **Edge max-connections cap** (Caddy/MediaMTX) — a hard ceiling on concurrent HLS
  readers (e.g. 30), so even a raw-`.m3u8` fetch cannot push concurrency past a
  known bound. This is what makes the app-level soft cap safe.
- **Hetzner traffic allowance + alerts** — ~20 TB/month included, ~€1/TB after,
  with console alerts configured.
- **Supabase / Vercel free tiers throttle rather than bill**; spend caps are
  toggled on if/when upgraded.

## Error handling

- **Invalid stream key** → `/api/ingest/auth` returns 401 → MediaMTX rejects the
  publish.
- **Forged hook calls** → ingest routes return 403 without the shared-secret
  header.
- **Stream key exposure** → isolated in `stream_keys`, owner-only RLS, validated
  server-side with the admin client; never sent to the browser.
- **HLS not ready immediately after going live** → hls.js retries the playlist.
- **MediaMTX crash without offline hook** → staleness guard treats a stale `live`
  row as offline.
- **Realtime disconnect** → the Supabase client auto-reconnects; chat and presence
  resubscribe.
- **Presence race at the cap boundary** → deterministic rank ordering (sorted by
  presence key/join time) decides admission; the marginal viewer sees the full
  wall rather than a flickering player.

## Security

- Supabase RLS on all new tables; `stream_keys` never publicly readable.
- Ingest hook routes authenticated by a shared secret stored server-side.
- Stream key stored as a secret; shown to the owner only via an owner-scoped
  server action.
- Edge connection cap bounds resource exhaustion.

## Testing strategy

- **Unit:** presence rank/cap-admission logic; ingest-auth key validation;
  stream-key regeneration.
- **Integration (RLS):** anonymous can read `channels`, `streams`, and
  `chat_messages` but **not** `stream_keys`; authenticated can insert a
  `chat_messages` row only as itself; only the channel owner can read/rotate the
  key; ingest hooks reject requests missing the shared secret.
- **E2E (Playwright):** offline card shown when no live stream exists; player
  mounts when a live `streams` row exists; "stream full" wall when presence is
  simulated past `max_viewers`; chat composer hidden/blocked for anonymous and
  functional for authenticated users.
- **Pipeline smoke (manual, documented in the runbook):** push a looping FFmpeg
  test file over RTMP → assert the stream flips to `live` → assert the hls.js
  player plays → stop → assert it flips to `ended`.

## UI changes

### Remove (delete files)
- `/credits` page, `components/credits-badge.tsx`, the credits store slice.
- `/watch/[videoId]` page and VOD components: `video-card.tsx`, `video-grid.tsx`,
  `stream-history-item.tsx`, `view-chart.tsx`.
- Studio `/upload` and `/videos` pages.
- Placeholder components once their consumers are removed:
  `player-placeholder.tsx`, `live-chat-placeholder.tsx`, `coming-soon.tsx`.

### Trim
- **Home** — keep the live player + chat + offline "next stream" card; remove the
  VOD stream-history list and the "watch latest VOD" button.
- **Nav** — remove the credits badge.
- **`sign-in-wall.tsx`** — repurpose as the **"Stream is full"** wall (the cap is
  free and applies to everyone; it is no longer a sign-in gate).
- **Studio** — reduce to a **Go live** page (stream key + status) and a minimal
  **Settings** page.

### Keep
- Auth flows (login/signup/verify/callback/error), account page.
- Nav, theming, logo.
- Channel page (`[channelSlug]`).
- `/live` and the home live area (rebuilt with the real player + chat).

## Infrastructure deliverable (VM runbook)

The OpenSpec change includes a runbook the owner follows to provision the VM:
- MediaMTX install + config: RTMP ingest, external HTTP auth hook, `runOnReady` /
  `runOnNotReady` hooks pointing at the app's ingest routes with the shared secret,
  HLS muxer settings.
- Caddy install + config: TLS for `stream.vids.tube`, reverse proxy to MediaMTX
  HLS, hard max-connections limit.
- DNS: `stream.vids.tube` → VM.
- Firewall: RTMP ingest port restricted; HTTP/HTTPS open for HLS.
- OBS settings: server URL, stream key, 720p output.
- The pipeline smoke test above.

App-side tasks are verifiable via `tsc` / lint / `npm run build:local`; the VM
tasks are verified by the owner running the smoke test.

## Open questions for the OpenSpec change

- Exact edge connection-cap value (default proposal: 30, i.e. `max_viewers` + a
  small margin).
- Presence heartbeat / sync cadence and the staleness threshold (proposal: ~60s).
- Whether `hls_path` is a per-stream column set by the live hook or derived from
  the channel slug + a configured base URL (proposal: store on the row for
  multi-channel readiness).
