## Context

vids.tube is a green-field repository with a Next.js 16 (App Router) scaffold in
place. This change adds Supabase-backed auth, the channel data model, and a
public channel page, establishing the patterns the rest of v1 reuses. All work
follows the conventions in `CLAUDE.md` and the patterns in `docs/template_files/`.
It must be multi-channel-ready even though v1 serves a single owner channel. See
`openspec/project.md` for the stack summary.

## Goals / Non-Goals

**Goals:**
- Email/password auth (signup, login, logout) implemented per the template:
  React Query mutation hooks calling the Supabase **browser** client, with
  `sonner` toasts and a `useAuthStore` (Zustand) for client auth state.
- A `channels` table (multi-channel-ready) with RLS: public read, owner-only
  writes, pushed to the **remote** Supabase project.
- A public channel page rendered by slug; unknown slugs return 404.
- Channel data fetched through a server **action** (validates `auth.getUser()`)
  called from a React Query hook.
- Navigation reflecting auth state via the auth store.
- Shadcn/ui components throughout; `cn` from `@/lib/utils`.
- Playwright E2E for auth + channel page; a TypeScript script to verify RLS.
- Deployed to Vercel against the remote Supabase project, at `vids.tube`.

**Non-Goals:**
- **Middleware of any kind** — explicitly forbidden by CLAUDE.md.
- **Local Supabase / Docker / seed.sql / db reset** — the project is remote-only.
- Social login / MFA / password reset (email/password only for now).
- Video pipeline, VOD/live playback, credits, chat, comments, follow (later
  changes).
- Adaptive bitrate, shorts, multi-creator onboarding.

## Decisions

- **No middleware; client-side route protection.** Per CLAUDE.md, route
  protection and feature gating are handled by database queries in React Query
  hooks, not `middleware.ts`. Rationale: keeps auth/authorization logic
  co-located with the data it guards and avoids edge-middleware coupling.
  Alternative considered: `@supabase/ssr` middleware session refresh — rejected
  because CLAUDE.md forbids middleware.

- **Three Supabase clients, mirroring `docs/template_files/`.**
  `supabase/browser-client.ts` exports a `supabase` singleton (used in hooks for
  auth + realtime); `supabase/server-client.ts` exports an async `createClient()`
  (used in actions); `supabase/admin-client.ts` exports `supabaseAdmin` using the
  secret key (used only in the seed/verification scripts, never in app code).
  Env is read through `@/lib/env.utils` (`ENV.SUPABASE_URL`,
  `ENV.SUPABASE_PUBLISHABLE_KEY`); the secret key comes from
  `process.env.SUPABASE_SECRET_KEY` (server/script only).

- **Auth runs in the browser client inside React Query hooks.** A `useUserAuth`
  hook (in `app/(auth)/login/page.hooks.tsx`) exposes `signUp` / `signIn` /
  `signOut` mutations using the browser client, mirroring
  `docs/template_files/template.hooks.tsx`. Success/error surface via `sonner`
  toasts through `@/components/CustomToast` (from
  `docs/template_files/CustomToast.template.tsx`); `useAuthStore` holds
  `{ user, isAuthenticated }`.

- **Email verification via an auth callback route.** Signup uses
  `emailRedirectTo` pointing at `app/auth/callback/route.ts`, which calls
  `supabase.auth.exchangeCodeForSession(code)` and redirects on success or to
  `app/auth/error/page.tsx` on failure — mirroring
  `docs/template_files/auth-callback-route.ts`. The signup hook handles the
  resend-on-existing-user path. Rationale: remote Supabase enforces confirmation;
  the templates already model this flow.

- **Server actions validate with `auth.getUser()`.** Channel reads/writes that
  need the server client live in `*.actions.ts` with `"use server"`, call
  `auth.getUser()`, throw on failure, and log with `console.error` — per
  `template.actions.ts`. Public channel reads do not require auth (RLS allows
  anonymous select).

- **`channels` table is multi-channel-ready.** A `channels` row keyed to
  `owner_user_id` with a unique `slug`. Rationale: avoids a painful migration when
  multi-creator support arrives in v3. Alternative (a single hard-coded channel)
  rejected as short-sighted.

- **RLS: public SELECT, owner-only INSERT/UPDATE/DELETE** via
  `owner_user_id = (select auth.uid())`. Rationale: channel pages are public;
  writes restricted to the owner. Matches the real access model.

- **Remote-only Supabase workflow with TypeScript seeding.** Migrations created
  with `npx supabase migration new`, applied to the linked remote with
  `npx supabase db push` (or `npx supabase db reset --linked --yes` to rebuild +
  reseed); types via `npx supabase gen types typescript --project-id <ref> >
  supabase/types.ts`. The owner account + channel are created by a TypeScript
  seed (`supabase/seed.ts`, run with `tsx`, using `supabaseAdmin` and
  `auth.admin.createUser({ email_confirm: true })`), wrapped by `reset-seed.sh` —
  mirroring `docs/template_files/seed.template.ts` and `reset-seed.sh`. RLS is
  verified by a similar `tsx` script using the admin + anon clients (CLAUDE.md
  forbids `psql`). Rationale: the project has no local database; seeding/queries
  go through TypeScript scripts against the linked remote.

- **File layout per CLAUDE.md.** Co-located `page.hooks.tsx` / `page.types.ts`
  with each route; shared auth store/types in `app/layout.stores.ts` /
  `app/layout.types.ts`. Supabase clients at `@/supabase/browser-client` and
  `@/supabase/server-client`; types at `@/supabase/types`.

## Risks / Trade-offs

- [No middleware means the server client may read a stale/expired token] → Auth
  state and route protection are client-side (browser client + React Query +
  Zustand); server actions independently re-validate via `auth.getUser()`, so a
  stale server cookie cannot grant access.
- [Remote-only DB makes automated RLS testing touch a real project] → Use a
  dedicated dev/staging Supabase project for the RLS verification script; never
  run it against production. Keep test rows namespaced and cleaned up.
- [Root-level dynamic route `app/[channelSlug]` catches all single-segment paths]
  → Static routes (`/login`, `/signup`, `/verify`) take precedence in Next.js
  routing, so reserved paths resolve correctly.
- [Next.js 16 breaking changes] → Consult `node_modules/next/dist/docs/` (per
  `AGENTS.md`) before writing app code; do not assume prior-version APIs.
- [Email verification adds a step to the signup E2E] → The E2E either uses a
  pre-verified test account or asserts the verification-pending state rather than
  a full inbox round-trip.

## Migration Plan

- Schema: `npx supabase migration new channels` → write SQL → `npx supabase db
  push` to the linked remote project. Generate types with `npx supabase gen
  types ... --project-id <ref>`.
- Owner account + channel created by `supabase/seed.ts` (run via `tsx`, or
  through `reset-seed.sh`), using `supabaseAdmin`.
- Deploy: import repo to Vercel, set `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and `SUPABASE_SECRET_KEY` only if a
  server route later needs admin access — not for this change), add `vids.tube`
  custom domain.
- Rollback: revert the Vercel deployment; the `channels` migration is additive
  and safe to leave in place.

## Open Questions

- Whether to add password reset before the social-features change (P6).
- Whether a separate dev/staging Supabase project exists for the RLS script, or
  whether RLS is verified manually for now.
- Whether profile fields beyond Supabase Auth defaults are needed before P6.
