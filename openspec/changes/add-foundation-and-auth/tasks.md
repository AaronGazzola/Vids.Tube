# Tasks: add-foundation-and-auth

> Follow the conventions in `CLAUDE.md` and the reference implementations in
> `docs/template_files/`. Key rules: **no middleware**; **remote-only Supabase**
> (no local db); React Query hooks call server actions / browser-client auth;
> Zustand stores; Shadcn UI + `sonner` toasts; throw all errors (log with
> `console.error`); no comments; `cn` from `@/lib/utils`. Next.js 16 — consult
> `node_modules/next/dist/docs/` before writing app code (`AGENTS.md`).
>
> Reference files (copy/adapt, don't reinvent):
> `docs/template_files/{browser-client.ts, server-client.ts, admin-client.ts,
> auth-callback-route.ts, auth-error-page.tsx, CustomToast.template.tsx,
> seed.template.ts, reset-seed.sh, template.actions.ts, template.hooks.tsx,
> template.stores.ts, template.types.ts}`.
>
> Note: the older `docs/superpowers/plans/2026-05-23-p1-foundation-and-auth.md`
> is **superseded**; do not follow its middleware/local-Supabase/raw-form code.

## 1. Dependencies & app shell

- [x] 1.1 Add deps: `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `sonner`, `lucide-react`; dev: `tsx`, `dotenv`; init Shadcn/ui; ensure `cn` exists in `@/lib/utils`
- [x] 1.2 Create `@/lib/env.utils` (`ENV` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; `getBrowserAPI` helper) per `browser-client.ts`'s imports
- [x] 1.3 Add a React Query provider, the `sonner` `<Toaster />`, and `@/components/CustomToast` (from `CustomToast.template.tsx`); wire them into `app/layout.tsx`

## 2. Supabase clients & types (remote)

- [x] 2.1 Create `supabase/browser-client.ts` (singleton `supabase`), `supabase/server-client.ts` (`createClient()`), and `supabase/admin-client.ts` (`supabaseAdmin`, secret key) from the templates; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` in `.env.local`; add committed `.env.example`
- [x] 2.2 Generate DB types: `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`

## 3. Channels schema & RLS (remote)

- [x] 3.1 `npx supabase migration new channels`; write the `channels` table (`id`, `owner_user_id` → `auth.users`, unique `slug`, `name`, `description`, `created_at`) + RLS (public SELECT; owner-only INSERT/UPDATE/DELETE via `owner_user_id = (select auth.uid())`); `npx supabase db push`; regenerate types (Task 2.2)
- [x] 3.2 Write a `tsx` RLS verification script (using `supabaseAdmin` + an anon client, per `seed.template.ts` style) that asserts: anonymous can SELECT channels; an owner can INSERT their own channel; a cross-user INSERT is rejected; run it and confirm expected results

## 4. Authentication (browser client + React Query + Zustand)

- [x] 4.1 Add `app/layout.types.ts` (`User`, `AuthState` from `@/supabase/types`) and `app/layout.stores.ts` (`useAuthStore` with `{ user, isAuthenticated, setUser }`), per `template.types.ts` / `template.stores.ts`
- [x] 4.2 Add the auth callback + error pages: `app/auth/callback/route.ts` (`exchangeCodeForSession`, from `auth-callback-route.ts`) and `app/auth/error/page.tsx` (from `auth-error-page.tsx`)
- [x] 4.3 Login route: `app/(auth)/login/page.tsx` (Shadcn form), `app/(auth)/login/page.hooks.tsx` (`useUserAuth` with `signIn` mutation via browser client; invalidate `["user"]`; CustomToast success/error), `app/(auth)/login/page.types.ts`
- [x] 4.4 Signup route: `app/(auth)/signup/page.tsx` + `app/(auth)/signup/page.hooks.tsx` (`signUp` with `emailRedirectTo` → `/auth/callback`; resend-on-existing-user path; success/notification CustomToast; route to a verification-pending page)
- [x] 4.5 Add `signOut` to `useUserAuth` (browser client; invalidate `["user"]`; toast) and a nav component that derives auth controls from `useAuthStore`; render nav in `app/layout.tsx`
- [x] 4.6 Auth E2E (`tests/e2e/auth.spec.ts`): signup shows verification-pending state; login with a seeded pre-verified test account; logout returns to logged-out controls; run and confirm PASS

## 5. Public channel page

- [x] 5.1 `app/[channelSlug]/page.actions.ts` (`getChannelBySlugAction` using server client; public read), `app/[channelSlug]/page.hooks.tsx` (`useChannel`), `app/[channelSlug]/page.types.ts`, `app/[channelSlug]/page.tsx` (shell renders immediately; channel name/description show inline skeletons while loading; not-found state when the query returns no row)
- [x] 5.2 Add `supabase/seed.ts` (from `seed.template.ts`) creating the owner account (`auth.admin.createUser({ email_confirm: true })`) + owner `channels` row; add `reset-seed.sh`; run the seed against the linked remote
- [x] 5.3 Channel-page E2E (`tests/e2e/channel-page.spec.ts`): seeded owner channel renders name/description; unknown slug shows the not-found state; run and confirm PASS

## 6. Verify & deploy

- [x] 6.1 `npx tsc --noEmit` and `npm run lint` clean; run E2E suite and the RLS verification script; confirm all green

> Non-code deploy/ops tasks moved to Linear per CLAUDE.md spec governance: Vercel production deploy + verify → AZ-49; `vids.tube` custom domain → AZ-50.
