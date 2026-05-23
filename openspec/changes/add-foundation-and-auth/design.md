## Context

vids.tube is a green-field repository. This change creates the application
foundation: a Next.js app, Supabase-backed auth, the channel data model, and a
public channel page. It must establish patterns (auth, RLS, migrations, testing)
that the remaining v1 changes reuse, and it must be multi-channel-ready even
though v1 serves a single owner channel. See `openspec/project.md` for the
stack and conventions.

## Goals / Non-Goals

**Goals:**
- A deployable Next.js app with email/password auth (signup, login, logout).
- A single, trustworthy server-side current-user check.
- A `channels` table with RLS: public read, owner-only writes.
- A public channel page; unknown slugs return 404.
- Test patterns: RLS integration tests (Vitest) and auth/page E2E (Playwright).
- Deployed to Vercel against hosted Supabase, reachable at `vids.tube`.

**Non-Goals:**
- Video pipeline, VOD/live playback, credits, chat, comments, follow (later
  changes).
- Social login / MFA / password reset flows (email/password only for now).
- Email confirmation in local dev (disabled to keep the loop fast; may be
  re-enabled in production later).
- Adaptive bitrate, shorts, multi-creator onboarding.

## Decisions

- **`@supabase/ssr` with cookie sessions, refreshed in middleware.**
  Rationale: the current, supported pattern for Supabase auth in Next.js App
  Router. Alternative considered: deprecated `@supabase/auth-helpers` — rejected
  (superseded). Server auth decisions use `supabase.auth.getClaims()`, never
  `getSession()`, which is not guaranteed to revalidate the token in server code.

- **Email/password auth only.** Rationale: simplest viable auth for an
  owner-first MVP. Alternatives: Clerk (best UX, but splits the stack and adds a
  vendor) or social login (more setup, not needed yet) — deferred.

- **`channels` table is multi-channel-ready from day one.** A `channels` row
  keyed to `owner_user_id` with a unique `slug`. Rationale: avoids a painful
  migration when multi-creator support arrives in v3; the cost now is trivial.
  Alternative: a single hard-coded channel — rejected as short-sighted given the
  platform vision.

- **RLS: public SELECT, owner-only INSERT/UPDATE/DELETE.** Channel pages are
  public, so anonymous read is allowed; writes are restricted to the owner via
  `owner_user_id = (select auth.uid())`. Rationale: matches the real access
  model rather than a blanket `auth.uid()` policy.

- **Local dev via Supabase CLI (Docker) with migrations + seed.** Rationale:
  reproducible schema, real RLS to test against, clean migration history for the
  hosted deploy. The seed creates an owner account + channel (incl. an
  `auth.identities` row so password sign-in works locally).

- **Vitest for RLS integration, Playwright for E2E.** Rationale: RLS is best
  verified against a real Postgres with two client roles (anon + authenticated);
  auth flows are inherently browser-level. Test env is loaded from `.env.local`
  via a dedicated setup file (plain `dotenv/config` only reads `.env`).

## Risks / Trade-offs

- [Email confirmation disabled locally diverges from production] → Documented as
  a non-goal; production re-enables confirmation in a later hardening pass.
- [Root-level dynamic route `app/[channelSlug]` catches all single-segment paths]
  → Static routes (`/login`, `/signup`, `/auth/*`) take precedence in Next.js
  routing, so reserved paths resolve correctly; acceptable for v1.
- [Hand-written seed inserts into `auth.users`/`auth.identities` can break across
  GoTrue versions] → Seed is local-dev only and not exercised by login in tests;
  production owner is created via the dashboard.
- [Service role key misuse] → Never set in the browser/Vercel for this change;
  used only by integration tests and admin scripts locally.

## Migration Plan

- Local: `supabase start` → `supabase migration up` → `supabase db reset`
  (applies migrations + seed).
- Hosted: `supabase link` → `supabase db push` (migrations only; never run the
  local seed against production). Create the production owner account + channel
  via the dashboard/SQL editor.
- Deploy: import repo to Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, add `vids.tube` custom domain.
- Rollback: revert the Vercel deployment; the `channels` migration is additive
  and safe to leave in place.

## Open Questions

- Whether/when to re-enable email confirmation and add password reset in
  production (deferred to a hardening change).
- Whether profile fields beyond Supabase Auth defaults are needed before the
  social features change (P6).
