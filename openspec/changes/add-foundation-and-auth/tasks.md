# Tasks: add-foundation-and-auth

> Follow the conventions in `CLAUDE.md` and the patterns in
> `docs/template_files/template.{types.ts,actions.ts,hooks.tsx,stores.ts}`.
> Key rules: **no middleware**; **remote-only Supabase** (no local db); React
> Query hooks call server actions / browser-client auth; Zustand stores; Shadcn
> UI + `sonner` toasts; throw all errors (log with `console.error`); no comments;
> `cn` from `@/lib/utils`. Next.js 16 — consult `node_modules/next/dist/docs/`
> before writing app code (`AGENTS.md`).
>
> Note: the older `docs/superpowers/plans/2026-05-23-p1-foundation-and-auth.md`
> is **superseded** (it predates these conventions); do not follow its
> middleware/local-Supabase/raw-form code.

## 1. Dependencies & app shell

- [ ] 1.1 Add deps: `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `sonner`; init Shadcn/ui; ensure `cn` exists in `@/lib/utils`
- [ ] 1.2 Add a React Query provider, the `sonner` `<Toaster />`, and a `@/components/CustomToast` component; wire them into `app/layout.tsx`

## 2. Supabase clients & types (remote)

- [ ] 2.1 Create `supabase/browser-client.ts` (`createBrowserClient`) and `supabase/server-client.ts` (`createServerClient`, publishable key, cookie getAll/setAll); set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`; add committed `.env.example`
- [ ] 2.2 Generate DB types: `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`

## 3. Channels schema & RLS (remote)

- [ ] 3.1 `npx supabase migration new channels`; write the `channels` table (`id`, `owner_user_id` → `auth.users`, unique `slug`, `name`, `description`, `created_at`) + RLS (public SELECT; owner-only INSERT/UPDATE/DELETE via `owner_user_id = (select auth.uid())`); `npx supabase db push`; regenerate types
- [ ] 3.2 Write a custom TypeScript verification script (not `psql`) that checks: anonymous can SELECT channels; an owner can INSERT their own channel; a cross-user INSERT is rejected; run it against the dev project and confirm expected results

## 4. Authentication (browser client + React Query + Zustand)

- [ ] 4.1 Add `app/layout.types.ts` (`User`, `AuthState` from `@/supabase/types`) and `app/layout.stores.ts` (`useAuthStore` with `{ user, isAuthenticated, setUser }`)
- [ ] 4.2 Login route: `app/(auth)/login/page.tsx` (Shadcn form), `app/(auth)/login/page.hooks.tsx` (`useUserAuth` with `signIn` mutation via browser client; invalidate `["user"]`; success/error toasts), `app/(auth)/login/page.types.ts`
- [ ] 4.3 Signup route: `app/(auth)/signup/page.tsx` + `app/(auth)/signup/page.hooks.tsx` (`signUp` mutation with `emailRedirectTo`; resend-on-existing-user path; success/notification toasts; route to verify) + `app/(auth)/verify/page.tsx`
- [ ] 4.4 Add `signOut` to `useUserAuth` (browser client; invalidate `["user"]`; toast) and a nav component that derives auth controls from `useAuthStore`; render nav in `app/layout.tsx`
- [ ] 4.5 Auth E2E (`tests/e2e/auth.spec.ts`): signup shows verification-pending state; login with a pre-verified test account; logout returns to logged-out controls; run and confirm PASS

## 5. Public channel page

- [ ] 5.1 `app/[channelSlug]/page.actions.ts` (`getChannelBySlugAction` using server client; public read), `app/[channelSlug]/page.hooks.tsx` (`useChannel`), `app/[channelSlug]/page.types.ts`, `app/[channelSlug]/page.tsx` (page shell renders immediately; channel name/description show inline skeletons while loading; not-found state when the query returns no row)
- [ ] 5.2 Create the owner account (Supabase dashboard) and insert the owner `channels` row (SQL editor) on the remote project
- [ ] 5.3 Channel-page E2E (`tests/e2e/channel-page.spec.ts`): seeded owner channel renders name/description; unknown slug shows the not-found state; run and confirm PASS

## 6. Verify & deploy

- [ ] 6.1 `npx tsc --noEmit` and `npm run lint` clean; run E2E suite and the RLS verification script; confirm all green
- [ ] 6.2 Deploy to Vercel with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; verify auth + `/owner` in production
- [ ] 6.3 Add `vids.tube` custom domain in Vercel and confirm the site resolves
