# vids.tube — Product Roadmap

**Date:** 2026-05-23
**Last updated:** 2026-05-29
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

### v1 — MVP (in progress)

**Shipped (2026-05-25, deployed at vids.tube):**
- Auth (Supabase) — login / signup / verify.
- Single-channel pages with multi-channel-ready data model.
- Studio "Go live" page (shows owner the RTMP server + stream key for OBS).
- Live streaming (owner only): OBS → RTMP → MediaMTX on a Hetzner VM → **LL-HLS** at `stream.vids.tube` (nginx + Let's Encrypt). ~1–3s latency.
- Live chat via Supabase Realtime, persisted in `chat_messages`.
- Live access model: **free + concurrent-viewer cap** (soft cap via Realtime Presence "stream full" wall, default 25; backstopped by a hard edge bandwidth cap on the VM). The originally-designed credit-gating is sequenced as a later v1 slice — see [Finishing v1 — plan](#finishing-v1--plan).

**Remaining to finish v1 (see Finishing v1 — plan):**
- Automatic VOD recording → Cloudflare R2; free VOD playback page + channel listing.
- Comments on VODs (auth required).
- Follow / subscribe to a channel.

**Credits: deferred out of v1 (decided 2026-05-29).** Live stays **free + viewer-capped**. The full credit system (signup grant + Stripe top-ups + per-minute live metering + balance UI + credit-gating) is **not** part of finishing v1 — it becomes its own future `add-credits` change. The design is preserved below under [Deferred — Credit system](#deferred--credit-system) and in the [v1 design spec](./2026-05-23-vids-tube-v1-design.md); nothing is being built or scaffolded now.

See the [v1 design spec](./2026-05-23-vids-tube-v1-design.md) for the full original scope (credits included there are now deferred per above).

### v2 — Content depth
- Shorts: clip-from-stream UI, vertical reformat pipeline, vertical feed + swipe player.
- Adaptive bitrate ladder (e.g. 360p / 720p / 1080p).
- Creator analytics dashboard (retention curves, watch-time) from the watch
  data already captured in v1.
- (Low-latency HLS already shipped in v1.)

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
| Live delivery | LL-HLS (1s segments / 200ms parts), nginx on the VM |
| Payments | Stripe (credit top-ups) |
| App hosting | Vercel (hobby) initially; revisit self-host later |

## Finishing v1 — plan

The remaining MVP work, broken into **three** ordered slices (credits deferred —
see below). Each slice gets its own spec → implementation plan → build cycle.
External setup needed before any of this starts is covered in the
[Finishing v1 — External Setup](./2026-05-29-finishing-v1-setup-design.md) doc.
External services needed across *all* future milestones (v1→v4+) are catalogued
in [External Services Across the Roadmap](./2026-05-29-external-services-roadmap.md).

### Slice 1: VOD pipeline

**Goal:** Every completed live stream becomes a free-to-watch VOD on the channel
page.

**Now specced in OpenSpec:** the authoritative detail lives in the
`add-vod-pipeline` change (`openspec/changes/add-vod-pipeline/`). The decisions
below were settled there: record fMP4 on the VM → finalize to a single seekable
MP4 (`-c copy`) → upload to R2; two-phase publish (the `offline` hook creates a
`processing` `videos` row, a new `/api/ingest/recording` hook flips it `ready`);
watch page plays the MP4 via a native `<video>` from `cdn.vids.tube`; channel
page lists `ready` VODs newest-first; public + free (no token, no cap). Remaining
open questions (thumbnail frame, local retention, crashed-stream VOD) are tracked
in that change's `design.md`.

**External deps:** R2 + `cdn.vids.tube` (done — verified 2026-05-29; cdn cert
provisioning at last check).

### Slice 2: Comments on VODs

**Goal:** Authenticated users can comment on a VOD; comments render under the
player.

**In scope:**
- `comments` table (`id`, `video_id`, `user_id`, `body`, `created_at`) with RLS:
  public read; authenticated insert-as-self; own-delete; no edits.
- Comment list + composer under the VOD player.
- Realtime: prefer Supabase Realtime subscribe for new comments; acceptable
  fallback is poll-on-focus (decide in spec based on whether Realtime channel
  count is a concern).

**Open questions:** flat vs threaded (recommend flat for v1); per-user
rate-limit. Moderation tooling is deferred to v4.

**External deps:** none.

### Slice 3: Follow / subscribe

**Goal:** Authenticated users can follow a channel; the channel page shows
follower count and a follow/unfollow button.

**In scope:**
- `follows` table (already in original v1 design) with RLS: user manages own
  follows; public can read aggregate count.
- Channel-page follow button + count.

**Out of scope:** following feed page (defer); follower notifications (defer to
v3 with the recommendation algorithm).

**External deps:** none.

### Deferred — Paid live (monetization)

**Status (2026-06-05): the monetization model was redesigned.** The per-minute
credit-wallet model below is **superseded** by a **per-stream access-ticket model
with dynamic, pre-booked pricing** — see
[Monetization Model Design](./2026-06-05-monetization-model-design.md) for the
authoritative design. In short: free = delayed cast from R2 (no chat); paid =
real-time live + chat; viewers buy bookable per-stream tickets (no wallet);
pricing is dynamic and pre-funds capacity ahead of need; streamers add their own
margin (100% to them, 0% platform cut beyond cost + processing). Build it for the
single owner-streamer first; prerequisites are Stripe, Terms/eligibility, and a
refund policy.

The original credit-wallet text is kept below for history only.

**Status (2026-05-29, historical): deferred out of finishing v1.** Live stays
free + viewer-capped. This is **not** being built or scaffolded now — no tables,
no types, no UI. When it is built it becomes its own `add-credits` OpenSpec
change. The Stripe account is ready; Stripe keys are not yet in Doppler and only
need to be added when this work starts. The design below is preserved as the seed
for that future change.

**Goal (future):** Re-introduce credit-gating on live, on top of the free+capped
model — signup grant, Stripe top-ups, per-minute live metering, balance UI.

**Intended scope (from the original v1 design):**
- `credit_ledger` (append-only) + `credit_balances` (materialized current
  balance for fast atomic deduction).
- Signup grant via a post-signup action or Supabase trigger.
- Stripe Checkout for top-ups; signature-verified, idempotent webhook → ledger
  row + balance increase.
- Short-TTL signed playback token for live; heartbeat (~10s) deducts credits
  via atomic guarded SQL update and re-validates entitlement.
- Balance UI on the account page; top-up modal on the live page when balance
  hits 0.
- Anonymous viewers: continue to allow under the existing per-stream cap
  without credits (so live stays accessible to anonymous viewers up to the cap,
  and the credit gate kicks in only for the authenticated path) — confirm in
  spec.

**Open questions (carried over from the original v1 design):**
- Signup grant amount, per-minute live price, credit-pack denominations
  (also Stripe product/price setup waits on these).
- Whether the per-stream anonymous cap stays once credits exist, and at what
  value.
- Playback-token TTL + heartbeat interval.
- Token-gating route in Next.js vs. a Cloudflare Worker at the edge.
- Whether the live URL itself moves behind a token (couples this slice to
  Slice 1's "does live move to R2" question).

**External deps (when built):** Stripe keys in Doppler (account already ready).

### Build order rationale

- **VOD first** — biggest remaining piece, unblocks comments (needs `videos`),
  and the main user-visible value-add post-live.
- **Comments + follow next** — cheap Supabase-only wins that enrich the channel
  and watch pages once VODs exist.
- **Credits deferred** — most complex piece, lowest near-term value at this
  scale, and live already works free + viewer-capped without it. Pulled out of
  the v1 finish line; revisit as `add-credits` later.
