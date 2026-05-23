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
| Web framework | Next.js 16 (App Router) on React 19, TypeScript |
| UI components | Shadcn/ui + TailwindCSS v4; toasts via `sonner` + `@/components/CustomToast` |
| State management | Zustand (client state), TanStack React Query (data fetching) |
| Auth + DB + Realtime | Supabase (Postgres, Auth, Realtime) — **remote only, no local db** |
| Object storage | Cloudflare R2 (zero egress) |
| CDN | Cloudflare |
| Ingest/transcode VM | Hetzner (dedicated CPU) |
| Live ingest engine | MediaMTX + FFmpeg |
| Live delivery | Standard HLS, single 720p rendition in v1 (ABR + LL-HLS later) |
| Payments | Stripe (credit top-ups) |
| App hosting | Vercel (hobby) initially |
| Tests | Playwright (E2E); DB/RLS checks via custom TypeScript scripts |

> The authoritative coding conventions live in `CLAUDE.md` at the repo root.
> The summary below must stay consistent with it; `CLAUDE.md` wins on conflict.
> Next.js 16 has breaking changes from prior versions — consult
> `node_modules/next/dist/docs/` before writing app code (see `AGENTS.md`).

## Conventions (summary of CLAUDE.md)

- **No middleware.** Route protection and feature gating are handled by database
  queries implemented in React Query hooks — never in `middleware.ts`.
- **Supabase clients:** browser client `@/supabase/browser-client` for auth
  operations (`signUp`/`signIn`/`signOut`) and realtime; server client
  `@/supabase/server-client` (publishable key) for table queries inside actions.
  Generated types at `@/supabase/types`.
- **Actions** (`*.actions.ts`): `"use server"`, validate auth with
  `auth.getUser()` before queries, called only from React Query hooks, named
  `featureNameAction`.
- **Hooks** (`*.hooks.tsx`): React Query (`useQuery`/`useMutation`) call actions;
  browser client for auth/realtime; update Zustand stores in `onSuccess`/`queryFn`;
  loading/error via React Query (not the store); named `useFeatureName`.
- **Stores** (`*.stores.ts`): Zustand; no `persist` for sensitive data; named
  `useFeatureNameStore`; file name is plural `*.stores.ts`.
- **Types** (`*.types.ts`): constructed from `@/supabase/types`; shared types in
  `layout.types.ts`, page-specific in `page.types.ts`.
- **Errors:** throw all errors (no fallback behavior); log with `console.error`.
- **No comments** in any files. No `console.log` in app code.
- **Class names:** import `cn` from `@/lib/utils`.
- **Loading skeletons:** render the full page immediately; replace only the
  data-dependent content (e.g. just the username text) with inline skeletons.
- **RLS on every table** in exposed schemas; policies match the real access
  model. Never use user-editable `user_metadata` in authorization.
- **Supabase is remote-only (no local db):** create migrations with
  `npx supabase migration new <name>` (never hand-write filenames); push with
  `npx supabase db push`; query the db via a custom TypeScript script (not
  `psql`); generate types with
  `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`.
- **Spec workflow:** OpenSpec is the source of truth. Each milestone/sub-project
  is a change in `openspec/changes/`; capabilities live in `openspec/specs/`.

## File organization

Co-locate utility files with the route they serve, following CLAUDE.md:

```txt
app/
├── layout.tsx, layout.stores.ts, layout.actions.ts, layout.types.ts
├── (auth)/login/
│   ├── page.tsx, page.hooks.tsx, page.types.ts
└── [channelSlug]/
    ├── page.tsx, page.actions.ts, page.types.ts
```

- Shared functionality (auth state, theme) → higher in the tree
  (`app/layout.stores.ts`).
- Section-specific → that section's `layout.*`.
- Page-specific → that page's `page.*`.
- Reference templates: `docs/template_files/template.{types.ts,actions.ts,hooks.tsx,stores.ts}`.

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

- **`CLAUDE.md`** (repo root) — authoritative coding conventions.
- **`docs/template_files/`** — canonical patterns for actions/hooks/stores/types.
- **`AGENTS.md`** — Next.js 16 agent rules (read the bundled Next docs first).
- **`docs/superpowers/`** — the original discovery/brainstorming artifacts
  (roadmap + v1 design + the P1 TDD plan). These record *how decisions were
  reached*; they predate the CLAUDE.md conventions and their middleware /
  local-Supabase / raw-form code is **superseded** by this change's artifacts.
  OpenSpec changes/specs + CLAUDE.md are the going-forward source of truth.
