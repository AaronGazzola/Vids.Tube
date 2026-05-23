# vids.tube — v1 (MVP) Design Spec

**Date:** 2026-05-23
**Status:** Approved (design); pending implementation plan
**Related:** [Roadmap](./2026-05-23-vids-tube-roadmap.md)

## Purpose

Ship a self-hosted live-streaming + VOD platform for the owner's personal use at
small scale, built on the architecture the full platform will scale on. v1
establishes the video pipeline, the credit-based economic primitive, and the
account/social foundation.

## Scope

### In scope
- Live streaming: owner streams from OBS via RTMP.
- Automatic VOD recording: every live stream is recorded and published as a VOD.
- VOD playback: free to watch, no credit cost, no gating.
- Live chat: real-time chat during streams (auth required to post).
- Credit system: signup allowance + Stripe top-ups; per-minute metering for live
  watching; balance deducted during playback.
- Per-stream anonymous viewer cap: when exceeded, new anonymous viewers hit a
  "sign in to keep watching (it's free to sign up)" wall.
- Auth: accounts via Supabase Auth.
- Comments on VODs (auth required).
- Follow / subscribe to a channel (auth required).
- Single channel (the owner), with a multi-channel-ready data model.

### Out of scope (deferred — see roadmap)
- Shorts (clip-from-stream UI, vertical feed).
- Adaptive bitrate ladder (v1 is a single 720p rendition).
- Low-latency HLS (v1 uses standard HLS, ~10–20s latency).
- Multi-creator onboarding, creator payouts.
- Transparent/configurable recommendation algorithm.
- Mobile apps, moderation tooling.

## Architecture

```
                          ┌─────────────────────────────────┐
   OBS ──RTMP(key)──►      Hetzner VM                        │
                          │  MediaMTX (RTMP ingest)          │
                          │   └─FFmpeg → 720p HLS + record   │
                          │  Segment uploader ───────────────┼──► Cloudflare R2
                          └──────────────────────────────────┘     (HLS segments,
                                                                     recordings,
                                                                     thumbnails)
                                                                          │
   Viewer ◄── hls.js ◄── Cloudflare CDN (free egress) ◄─────────────────┘
      │
      │  watch page / chat / credits / auth
      ▼
   Next.js (App Router)  ──►  Supabase (Postgres + Auth + Realtime)
      │
      └──► Stripe (credit top-ups)
```

### Components

1. **Next.js app (App Router, React).** Channel page, watch page (live + VOD),
   video player, live chat UI, auth flows, credit balance + top-up UI, owner's
   streamer/admin console. Hosts the playback-token and credit-metering API
   routes. Initial hosting: Vercel hobby.

2. **Supabase.** Postgres for all application data; Auth for accounts; Realtime
   for live chat and viewer presence/concurrent-count tracking.

3. **Hetzner ingest VM.** Runs:
   - **MediaMTX** — accepts RTMP from OBS (authenticated by stream key).
   - **FFmpeg** — transcodes the incoming stream to a single 720p HLS rendition
     and writes a recording to local disk.
   - **Segment uploader** — syncs HLS segments + playlist (live) and the
     finalized recording (VOD) to Cloudflare R2, with local buffering + retry.

4. **Cloudflare R2.** Stores all HLS segments, stream recordings, and
   thumbnails. Zero egress fees.

5. **Cloudflare CDN.** Edge-serves HLS to viewers; free egress; edge caching.

6. **Stripe.** Processes credit top-up purchases; webhooks credit the ledger.

## Data model (Postgres, multi-channel-ready)

Tables (indicative; refined during planning):

- `users` — managed by Supabase Auth; profile fields as needed.
- `channels` — `id`, `owner_user_id`, `slug`, `name`, `description`. (v1 has one
  row, the owner's, but the schema supports many.)
- `streams` — `id`, `channel_id`, `status` (idle/live/ended), `started_at`,
  `ended_at`, `stream_key_ref`, `hls_path`, `title`. Represents a live session.
- `videos` — `id`, `channel_id`, `source_stream_id` (nullable), `status`
  (processing/ready/failed), `hls_path` or `mp4_path`, `thumbnail_path`,
  `duration_s`, `title`, `published_at`. VODs (incl. recorded streams).
- `credit_ledger` — append-only: `id`, `user_id`, `delta`, `reason`
  (signup_grant / topup / live_watch / adjustment), `ref` (stripe id / stream
  id), `created_at`. Balance = sum(delta).
- `credit_balances` — materialized/maintained current balance per user for fast
  reads and atomic deduction (`balance` updated via guarded SQL; ledger is the
  source of truth).
- `comments` — `id`, `video_id`, `user_id`, `body`, `created_at`.
- `follows` — `id`, `follower_user_id`, `channel_id`, `created_at`.
- `chat_messages` — `id`, `stream_id`, `user_id`, `body`, `created_at`
  (delivered via Realtime; persisted for replay/moderation).

All user-scoped tables protected by Supabase Row Level Security (RLS).

## Key flows

### Live ingest
1. OBS pushes RTMP to the Hetzner VM using the owner's secret stream key.
2. MediaMTX authenticates the key and accepts the stream; marks the `streams`
   row `live`.
3. FFmpeg transcodes to a single 720p HLS rendition and writes a recording to
   local disk.
4. The uploader syncs HLS segments + playlist to R2 continuously.
5. Cloudflare CDN edge-caches; viewers play via hls.js.

### Playback auth + credit metering (live only)
1. Viewer opens a live page. Next.js checks:
   - Authenticated with `balance > 0`? → allowed.
   - Anonymous? → allowed only if this stream's current anonymous-viewer count
     is under the per-stream cap.
2. If allowed, Next.js issues a short-TTL signed playback token scoped to the
   stream.
3. The player fetches the HLS playlist through a token-gated route that
   validates the token and returns signed R2/CDN URLs for the segments.
4. The player sends a heartbeat (~every 10s). Each heartbeat:
   - Deducts credits for elapsed live watch time via an atomic guarded update
     (`balance = balance - n WHERE balance >= n`) and appends a ledger row.
   - Updates the viewer's presence (for concurrent counts).
   - Re-validates entitlement.
5. Balance reaches 0 → token revoked → player shows a top-up modal.
6. Anonymous count exceeds the per-stream cap → new anonymous viewers get the
   "sign in to keep watching (free)" wall. Existing anonymous viewers under the
   cap are unaffected.

Pricing note: live is metered **per minute**, priced to cover the highest
quality setting. (v1 has a single 720p rendition, so this is a fixed per-minute
rate; the per-quality framing matters once a ladder exists in v2.)

### VOD publication & playback
1. A live stream ends → FFmpeg finalizes the recording on local disk → uploader
   pushes it to R2 → a `videos` row is created with `status = ready`.
2. The VOD appears on the channel page.
3. VOD playback is **free**: no playback token, no credit deduction, no
   anonymous cap. (Public to watch.)

### Credit top-up (Stripe)
1. Authenticated user opens the top-up UI, selects an amount.
2. Stripe Checkout completes the purchase.
3. A signature-verified, idempotent Stripe webhook appends a `topup` ledger row
   and increases the balance.

## Error handling

- **Stream-key auth** enforced at MediaMTX; the key lives in server secrets and
  is never exposed client-side.
- **Transcode/ingest crash mid-stream:** MediaMTX restarts the FFmpeg pipeline;
  the player retries the playlist; chat persists across the gap.
- **Recording durability:** the recording is written to local disk first, then
  uploaded — a network blip cannot lose the VOD. Uploader retries with backoff.
- **R2 upload failure:** local buffer + retry; alerting if the backlog grows.
- **Credit race conditions:** deduction uses an atomic guarded SQL update; the
  ledger is append-only and is the source of truth for balance reconciliation.
- **Stripe webhooks:** signature-verified and idempotent (keyed by event id) to
  avoid double-crediting.
- **Playback token expiry mid-watch:** silently refreshed while credits remain;
  refresh denied (and playback stops with a top-up prompt) when balance is 0.

## Security

- Supabase RLS on all user-scoped tables (a user cannot read another user's
  ledger; cannot obtain a live playback token without sufficient credits or
  anonymous-cap eligibility).
- Short-TTL, stream-scoped signed playback tokens; segment URLs are signed and
  not guessable.
- Stripe webhook signatures verified.
- Stream key stored as a server secret.

## Testing strategy

- **Unit:** credit math (deduct, top-up, insufficient-balance guard), playback
  token issue/validate, anonymous-cap logic.
- **Integration:** Supabase RLS policies (no cross-user ledger reads; no live
  token without entitlement), Stripe test-mode webhook handling (including
  duplicate-delivery idempotency).
- **E2E (Playwright):** sign up → receive free credits → watch live → balance
  decrements → run out → top-up via Stripe test mode → resume; anonymous viewer
  → exceed per-stream cap → sign-in wall.
- **Pipeline smoke test:** push a looping test RTMP stream (FFmpeg from a file) →
  assert HLS segments land in R2 → assert the player plays → assert the
  recording is published as a VOD.

## Cost estimate (v1)

| Item | Monthly |
|---|---|
| Hetzner VM (dedicated CPU, e.g. CCX13) | ~€15 |
| Cloudflare R2 storage (grows with recordings) | $0 → ~$15 by end of year 1 |
| Cloudflare CDN egress | $0 |
| Supabase | $0 (free tier) → $25 when outgrown |
| Vercel (app hosting) | $0 hobby → ~$20 if needed |
| Stripe | per-transaction fees only |
| Domain (vids.tube) | ~$30/year |
| **Total** | **~$20–35/mo early, ~$60–80/mo as it grows** |

## Open questions for planning

- Exact signup credit grant amount and per-minute live price.
- Per-stream anonymous cap value.
- Playback-token TTL and heartbeat interval specifics.
- Whether the token-gating/segment-signing route runs in Next.js or a Cloudflare
  Worker at the edge (perf vs. simplicity).
- VM sizing validation under a real 720p transcode + recording load.
