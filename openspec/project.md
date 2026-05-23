# vids.tube — Project Context

## Purpose

A community-driven YouTube alternative with a clearer, more honest monetization
scheme that pays creators well, and a transparent, configurable recommendation
algorithm. The platform provides VODs, shorts, and live streaming.

The near-term work is the **v1 MVP**, scoped to the owner's personal use only:
their own live streams plus the VODs/short-clips derived from them, for a very
small audience (<10 concurrent viewers). The owner streams from OBS.

## Guiding principles

- **Own the pipeline.** Self-host the open-source video pipeline on managed
  infrastructure (Cloudflare R2 + a Hetzner VM) rather than using managed video
  services (Mux, Cloudflare Stream). Only the self-hosted path preserves access
  to the granular watch-event and playback layer that the long-term custom
  algorithm and monetization require — and it is ~5–10× cheaper at MVP scale.
- **Honest monetization.** Costs are surfaced to users, not hidden. The credit
  system ties what a viewer pays directly to the cost the platform incurs.
- **Build the economic primitive early.** Even at tiny scale where real dollar
  costs are low, v1 includes the real credit ledger and metering, because it is
  the platform's economic foundation.
- **Multi-tenant-ready, single-tenant now.** v1 has one channel (the owner), but
  schemas are modeled for many channels from day one.

## Cost model (key insight)

With **Cloudflare R2 + Cloudflare CDN, egress to viewers is $0**. Marginal cost
to serve a view — live or VOD — is therefore ~$0. Real costs are:
1. **Live transcode compute** — the VM runs FFmpeg in real time per stream-hour
   regardless of viewer count.
2. **Storage** — recordings accumulate (~$0.015/GB/month on R2).
3. **R2 operations** — negligible at this scale.

Consequences:
- **VOD watching is free** (sustainable: stored, cached delivery ≈ $0 marginal).
- **Live watching costs credits** — justified by live transcode compute and as
  the monetization/demand-shaping primitive, not strictly by per-viewer bandwidth.

## Tech stack (settled)

| Layer | Choice |
|---|---|
| Web framework | Next.js (App Router) on React, TypeScript |
| Auth + DB + Realtime | Supabase (Postgres, Auth, Realtime) |
| Object storage | Cloudflare R2 (zero egress) |
| CDN | Cloudflare |
| Ingest/transcode VM | Hetzner (dedicated CPU) |
| Live ingest engine | MediaMTX + FFmpeg |
| Live delivery | Standard HLS, single 720p rendition in v1 (ABR + LL-HLS later) |
| Payments | Stripe (credit top-ups) |
| App hosting | Vercel (hobby) initially |
| Tests | Vitest (unit/integration), Playwright (E2E) |

## Conventions

- **Supabase auth:** use `@supabase/ssr` (`createBrowserClient` /
  `createServerClient`); cookie sessions refreshed in `middleware.ts`. Trust
  `supabase.auth.getClaims()` for server-side auth decisions — never
  `getSession()`. Env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `SUPABASE_SERVICE_ROLE_KEY` is
  server-only.
- **RLS on every table** in exposed schemas; policies match the real access
  model. Never use user-editable `user_metadata` in authorization.
- **Migrations** via Supabase CLI (`supabase migration new`); never edit applied
  migrations, add new ones. Generate types with `supabase gen types`.
- **TDD:** write the failing test first, minimal implementation, frequent commits.
- **Spec workflow:** OpenSpec is the source of truth. Each milestone/sub-project
  is a change in `openspec/changes/`; capabilities live in `openspec/specs/`.

## Milestones

Each gets its own OpenSpec change (or set of changes).

- **v1 MVP** — decomposed into sequenced changes:
  - `add-foundation-and-auth` (this change): Next.js + Supabase scaffold, auth,
    channels schema, public channel page, deploy.
  - *Planned next:* video pipeline (Hetzner/MediaMTX/R2/CDN); VOD publication +
    playback; credits + Stripe; live playback + metering + anonymous cap; live
    chat + comments + follow.
- **v2 — Content depth:** shorts (clip-from-stream + vertical feed), ABR ladder,
  LL-HLS, creator analytics.
- **v3 — Platform opening:** multi-creator onboarding, creator payouts,
  transparent/configurable recommendation algorithm.
- **v4+ — Scale & trust:** multiple ingest VMs / autoscaling transcode, regional
  CDN tuning, moderation tooling, mobile apps.

## Reference docs

The original discovery/brainstorming artifacts live in
`docs/superpowers/specs/` (roadmap + v1 design) and `docs/superpowers/plans/`
(P1 TDD plan). OpenSpec changes/specs are the going-forward source of truth;
those docs are the historical record of how decisions were reached.
