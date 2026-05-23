# Tasks: add-foundation-and-auth

> Verbatim code, exact commands, and expected output for each step live in the
> companion TDD plan: `docs/superpowers/plans/2026-05-23-p1-foundation-and-auth.md`.
> This checklist mirrors that plan's tasks for OpenSpec tracking. Follow TDD:
> failing test → minimal implementation → passing test → commit.

## 1. Project scaffold & tooling

- [ ] 1.1 Scaffold the Next.js App Router app (TypeScript, Tailwind, ESLint, `@/*` alias); verify dev server boots; commit
- [ ] 1.2 Add Vitest + Playwright + dotenv; create `tests/setup-env.ts` (loads `.env.local`), `vitest.config.ts`, `playwright.config.ts`; add `test` / `test:watch` / `test:e2e` scripts; verify Vitest runs; commit

## 2. Supabase setup

- [ ] 2.1 `supabase init` and `supabase start`; create `.env.local` (URL, publishable key, service-role key) and committed `.env.example`; verify `.env.local` is gitignored; commit
- [ ] 2.2 Add Supabase client utilities: `utils/supabase/client.ts` (browser), `utils/supabase/server.ts` (cookies getAll/setAll), `utils/supabase/middleware.ts` (`updateSession` using `getClaims()`); typecheck; commit
- [ ] 2.3 Add root `middleware.ts` wiring `updateSession` with the asset-excluding matcher; verify app still boots; commit

## 3. Channels schema & RLS

- [ ] 3.1 `supabase migration new channels`; write the `channels` table + RLS (public SELECT; owner-only INSERT/UPDATE/DELETE via `owner_user_id = (select auth.uid())`); `supabase migration up`; run advisors; generate types to `utils/supabase/types.ts`; commit
- [ ] 3.2 Write the RLS integration test (`tests/integration/rls-channels.test.ts`): anonymous can read; owner can insert their own channel; cross-user insert is rejected; run and confirm PASS; commit

## 4. Authentication

- [ ] 4.1 Add `lib/auth.ts` with `requireUser()` (redirects to `/login` when no claims) and `getOptionalUser()` (non-redirecting), both using `getClaims()`; typecheck; commit
- [ ] 4.2 Add signup: `app/(auth)/signup/actions.ts` + `app/(auth)/signup/page.tsx`; disable email confirmation in local `config.toml` and restart Supabase; smoke-check signup; commit
- [ ] 4.3 Add login + logout: `app/(auth)/login/actions.ts`, `app/(auth)/login/page.tsx`, `app/auth/signout/route.ts`; typecheck; commit
- [ ] 4.4 Add `components/nav.tsx` reflecting auth state and render it in `app/layout.tsx`; typecheck; commit
- [ ] 4.5 Write the auth E2E test (`tests/e2e/auth.spec.ts`): sign up → sign out → log back in; run and confirm PASS; commit

## 5. Public channel page

- [ ] 5.1 Add `app/[channelSlug]/page.tsx` rendering channel name + description by slug, with `notFound()` for unknown slugs; typecheck; commit
- [ ] 5.2 Add local seed (`supabase/seed.sql`): owner `auth.users` + `auth.identities` row + `channels` row; ensure `[db.seed]` enabled; `supabase db reset`; verify `/owner` renders; commit
- [ ] 5.3 Write the channel-page E2E test (`tests/e2e/channel-page.spec.ts`): seeded channel renders; unknown slug returns 404; run and confirm PASS; commit

## 6. Verify & deploy

- [ ] 6.1 Run full suite green: `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`; commit any fixes
- [ ] 6.2 Create hosted Supabase project; `supabase link` + `supabase db push` (migrations only, never the seed); create the production owner account + channel via dashboard/SQL
- [ ] 6.3 Deploy to Vercel with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no service-role key); verify auth + `/owner` in production
- [ ] 6.4 Add `vids.tube` custom domain in Vercel and confirm the site resolves
