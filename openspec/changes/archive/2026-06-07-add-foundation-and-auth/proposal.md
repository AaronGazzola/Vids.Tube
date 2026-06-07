## Why

vids.tube has no application yet. Every later capability (video pipeline, VOD
playback, credits, live, chat) depends on a deployed web app with user accounts
and a channel model. This change establishes that foundation so the rest of v1
can build on it.

## What Changes

- Scaffold the Next.js (App Router, TypeScript) application with Tailwind.
- Add the Supabase integration via `@supabase/ssr`: browser client, server
  client, and session-refresh middleware.
- Add email/password authentication: signup, login, logout, and a server-side
  `requireUser` / `getOptionalUser` helper that trusts `getClaims()`.
- Add the `channels` table (multi-channel-ready) with Row Level Security:
  public read, owner-only writes.
- Add a public channel page rendered from channel data, with a 404 for unknown
  slugs.
- Add navigation that reflects auth state.
- Seed a local-dev owner account + channel; create the production owner channel
  on deploy.
- Set up testing (Vitest for RLS integration, Playwright for auth + channel-page
  E2E) and deploy to Vercel against a hosted Supabase project at `vids.tube`.

## Capabilities

### New Capabilities
- `auth`: email/password account signup, login, logout, cookie-based sessions
  refreshed in middleware, and a trustworthy server-side current-user check.
- `channels`: a multi-channel-ready channel record (owner, slug, name,
  description) with public read access, owner-only mutation, and a public
  channel page.

### Modified Capabilities
<!-- None — this is the first change; no existing capabilities. -->

## Impact

- New app code: `app/`, `components/`, `lib/`, `utils/supabase/`, `middleware.ts`.
- New dependencies: `@supabase/supabase-js`, `@supabase/ssr`; dev: `vitest`,
  `@playwright/test`, `dotenv`.
- New Supabase migration (`channels`) + local seed; hosted Supabase project +
  Vercel deployment + `vids.tube` domain.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server/test only).
- Establishes integration points later changes depend on: `channels.id` (FK
  target) and the `requireUser` / `getOptionalUser` helpers.
