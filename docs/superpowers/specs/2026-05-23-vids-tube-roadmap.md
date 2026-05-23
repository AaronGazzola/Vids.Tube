# vids.tube — Product Roadmap

**Date:** 2026-05-23
**Domain:** vids.tube
**Status:** Active

## Vision

A community-driven YouTube alternative with a clearer, more honest monetization
scheme that pays creators well, and a transparent, configurable recommendation
algorithm. The platform provides VODs, shorts, and live streaming.

The near-term MVP is for the owner's personal use: hosting their own live streams
and the VODs/clips derived from them, for a very small audience. The architecture
chosen for the MVP is the architecture the platform scales on — every decision
favors owning the playback and analytics layer, because the long-term
differentiators (custom monetization, transparent algorithm, creator payouts)
all require it.

## Guiding principles

- **Own the pipeline.** Managed video services (Mux, Cloudflare Stream) are
  faster to ship but make custom monetization and a transparent algorithm
  impossible — they own the playback and watch-event layer. We self-host the
  open-source pipeline on managed infrastructure (Cloudflare R2 + a small VM).
- **Honest monetization.** Costs are surfaced to users, not hidden. The credit
  system ties what a viewer pays directly to the cost the platform incurs.
- **Build the economic primitive early.** Even at tiny scale where real dollar
  costs are low, v1 includes the real credit ledger and metering, because it is
  the platform's economic foundation.

## Build-vs-buy decision (settled)

**Chosen: open-source pipeline on managed infrastructure.**

At the MVP scale (~30 hrs/month live ingest, <10 concurrent viewers, ~1 TB/year
of recordings) the cost comparison was:

| Approach | Year-1 cost | Notes |
|---|---|---|
| Mux (fully managed) | ~$2,500 | Best quality; storage cost grows; vendor lock-in; no access to granular watch events. |
| Cloudflare Stream (fully managed) | ~$1,800 | Cheaper, integrated CDN; still owns playback layer; lock-in. |
| **Open-source on managed infra (chosen)** | **~$500–700** | Own the pipeline end-to-end; ~5–10× cheaper; only path compatible with the platform vision. |
| Fully self-hosted | n/a | Not viable for live on residential bandwidth/uptime. |

The cost difference matters, but the deciding factor is that only the
open-source path preserves access to the playback + analytics layer that the
long-term goals depend on.

## Cost model (a key cost insight)

With **Cloudflare R2 + Cloudflare CDN, egress to viewers is $0**. The marginal
cost to serve a view — live or VOD — is therefore essentially zero. The real
costs are:

1. **Live transcode compute** — the VM runs FFmpeg in real time for the whole
   stream duration regardless of viewer count (a fixed per-stream-hour cost).
2. **Storage** — recordings accumulate (~$0.015/GB/month on R2).
3. **R2 operations** — negligible at this scale.

Implications:
- **VOD watching is free** to users, and this is genuinely sustainable: stored,
  cached delivery has near-zero marginal cost. Only storage costs the platform.
- **Live watching costs credits**, justified by live transcode compute and as
  the monetization/demand-shaping primitive — not strictly by per-viewer
  bandwidth (which is ~$0). At v1 scale the dollar risk is small; the credit and
  cap mechanism exists to establish the economic foundation, not to stop
  bleeding money.

## Milestones

Each milestone gets its own spec → implementation plan → build cycle.

### v1 — MVP (current)
Live streaming (owner only), automatic VOD recording, free VOD playback, live
chat, credit system (signup allowance + Stripe top-ups, per-minute metering for
live), per-stream anonymous viewer cap, auth, comments on VODs, follow. Single
channel, multi-channel-ready data model. See the v1 design spec.

### v2 — Content depth
- Shorts: clip-from-stream UI, vertical reformat pipeline, vertical feed + swipe player.
- Adaptive bitrate ladder (e.g. 360p / 720p / 1080p).
- Low-latency HLS (LL-HLS) for ~3s live latency.
- Creator analytics dashboard (retention curves, watch-time) from the watch
  data already captured in v1.

### v3 — Platform opening
- Multi-creator onboarding (others can stream).
- Creator payouts: credits spent on a creator's streams convert to revenue
  share — the "pay creators well" goal.
- Transparent, configurable recommendation algorithm: user-tunable feed with
  surfaced ranking signals.

### v4+ — Scale & trust
- Multiple ingest VMs / autoscaling transcode.
- Regional CDN tuning.
- Moderation tooling.
- Mobile apps.

## Technology decisions (settled)

| Layer | Choice |
|---|---|
| Web framework | Next.js (App Router) on React |
| Auth + DB + Realtime | Supabase (Postgres, Auth, Realtime) |
| Object storage | Cloudflare R2 (zero egress) |
| CDN | Cloudflare |
| Ingest/transcode VM | Hetzner (dedicated CPU) |
| Live ingest engine | MediaMTX + FFmpeg |
| Live delivery | Standard HLS (LL-HLS deferred to v2) |
| Payments | Stripe (credit top-ups) |
| App hosting | Vercel (hobby) initially; revisit self-host later |
