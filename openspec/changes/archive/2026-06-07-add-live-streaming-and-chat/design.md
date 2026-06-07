## Context

vids.tube has functional auth, a `channels` table with RLS, and a navigable UI
skeleton with placeholders. This change builds the first functional slice — live
streaming + live chat, free, with a concurrent-viewer cap — on the self-hosted
pipeline the platform scales on. Full rationale and the four-decision history are
in `docs/superpowers/specs/2026-05-24-live-streaming-and-chat-design.md`.

## Goals / Non-Goals

**Goals:**
- Owner streams from OBS over RTMP; viewers watch free HLS.
- A 25-viewer concurrent cap on auth + anon alike, with a hard edge backstop.
- Real-time chat: anon reads, auth posts.
- A Studio Go live page with stream-key display + regeneration.
- Remove UI not needed for this slice.

**Non-Goals:**
- Credits, metering, Stripe (later slice).
- VOD recording, publication, playback.
- Adaptive bitrate / server-side transcode, low-latency HLS (v2).
- A hard token-gated segment proxy (the edge connection cap covers cost).
- Comments, follow/subscribe.

## Decisions

- **Remux, not transcode.** OBS outputs 720p; MediaMTX repackages H.264/AAC into
  HLS with no re-encode, so VM CPU stays near-idle and a cheap instance suffices.
  Single rendition only. Rationale: ABR is already a v2 item, so deferring
  transcode now costs nothing. Alternative (FFmpeg transcode) rejected: needs a
  bigger VM for no v1 benefit.

- **Soft app cap + hard edge cap.** The 25-limit is enforced in-app via Realtime
  Presence (player won't mount past the cap → "stream full" wall). Because the
  raw HLS URL stays fetchable, a hard **edge max-connections cap** (Caddy/MediaMTX,
  e.g. 30) bounds concurrency and therefore bandwidth/cost. Rationale: gives the
  nice UX cap *and* a genuine cost ceiling without building a token-gated proxy.
  Alternative (hard token proxy) rejected: large build, over-engineered for this
  scale.

- **Stream key isolated in its own table.** `channels` has a wide-open public
  SELECT, so the secret stream key lives in a separate `stream_keys` table with
  owner-only RLS, validated server-side with the admin (service-role) client and
  never sent to the browser except via an owner-checked server action.

- **Ingest hooks guarded by a shared secret.** MediaMTX calls
  `/api/ingest/{auth,live,offline}`; each requires a shared-secret header so
  stream state cannot be forged. Stream state lives on a `streams` row.

- **Staleness guard for crashed ingest.** Hooks stamp `last_seen_at`; a `live`
  row stale beyond ~60s reads as offline, covering a MediaMTX crash that skips the
  offline hook.

- **Direct-from-VM HLS, no R2/CDN.** Served straight from the VM via Caddy TLS.
  R2/CDN is the documented scale path but adds an uploader; the player URL is
  abstracted (`streams.hls_path`) so it can slot in later without app changes.

- **Conventions per CLAUDE.md.** Co-located `page.*`; actions validate
  `auth.getUser()`; hooks use React Query + the browser client for realtime;
  Zustand for client state; throw-on-error; no comments; `cn` from `@/lib/utils`;
  RLS on every table; remote-only Supabase migrations via the CLI.

## Risks / Trade-offs

- [Soft app cap is bypassable] → Backstopped by the hard edge connection cap, so
  cost stays bounded; acceptable at personal scale.
- [Single rendition — viewers get exactly what OBS sends] → Acceptable for v1; ABR
  is a v2 item.
- [Stale `live` state if MediaMTX crashes] → `last_seen_at` staleness guard.
- [Presence race at the cap boundary] → Deterministic member ordering decides
  admission so the marginal viewer gets a stable result.
- [Verification without a dev server] → App side via `tsc`/lint/`build:local`;
  the VM pipeline via the documented manual RTMP smoke test.

## Open Questions

- Edge connection-cap value (default 30 = `max_viewers` + margin).
- Presence sync cadence / staleness threshold (default ~60s).
- Whether `hls_path` is set per-stream by the live hook or derived from the
  channel slug + a configured base (default: store per-row for multi-channel
  readiness).
