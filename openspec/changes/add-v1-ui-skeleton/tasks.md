# Tasks: add-v1-ui-skeleton

> Follow `CLAUDE.md` + `docs/template_files/`. **Use shadcn/ui components
> wherever possible** — custom components are thin compositions of shadcn
> primitives, not bespoke markup. No comments; `cn` from `@/lib/utils`; Zustand
> for client state; React Query for any data; co-located `page.tsx` /
> `page.hooks.tsx` / `page.types.ts`. No middleware — gate routes client-side via
> auth state hooks. Verify with `tsc` / `lint` / `npm run build:local` (do NOT
> start a dev server; the user runs their own).

## 1. Design system, theming & app shell

- [ ] 1.1 Add shadcn primitives: `npx shadcn@latest add dropdown-menu avatar dialog alert-dialog tabs badge separator tooltip sheet table`
- [ ] 1.2 Theme system without next-themes: `components/theme-provider.tsx` (React context; toggles `.dark` on `documentElement`; persists to `localStorage`), a no-flash inline `<script>` in the **server** `app/layout.tsx` head, and `components/theme-toggle.tsx` (shadcn `button` + `dropdown-menu`: Light/Dark/System). Repoint `components/ui/sonner.tsx` to read theme from the provider (drop the `next-themes` import). Wrap `app/providers.tsx` children with `ThemeProvider`.
- [ ] 1.3 Add `useIsOwner()` to `app/layout.hooks.tsx` returning `isAuthenticated` for now (single-user seam for future `channel.owner_user_id === user.id`)
- [ ] 1.4 Rebuild `components/nav.tsx` (`TopNav`) from shadcn: logo link, `ThemeToggle`, `CreditsBadge` (`components/credits-badge.tsx`, shadcn `badge`, stubbed value from a `useCredits` stub store), and `AccountMenu` (`components/account-menu.tsx`, shadcn `dropdown-menu` + `avatar`, links: Account, Studio [if `useIsOwner`], Sign out; or Log in / Sign up when logged out)
- [ ] 1.5 Ensure the public layout renders `TopNav`; confirm route-group layouts isolate public vs studio (studio gets its own layout in Phase 4)
- [ ] 1.6 Restyle auth pages (`app/(auth)/login`, `signup`, `verify`, `app/auth/error/page.tsx`) to a consistent shadcn `card`-based layout; no behavior change

## 2. Public pages

- [ ] 2.1 Channel home `/` (`app/page.tsx` + `page.hooks.tsx` + `page.types.ts`): channel header, `components/live-banner.tsx` (not-live / live states), `components/video-card.tsx` + `components/video-grid.tsx` (shadcn `card` + `skeleton`, placeholder cards); fetch the owner channel via a hook (reuse existing channel action)
- [ ] 2.2 VOD watch `app/watch/[videoId]/page.tsx` (+ hooks/types): `components/player-placeholder.tsx` (VOD variant), title/description block, `components/comments-placeholder.tsx`
- [ ] 2.3 Live watch `app/live/page.tsx` (+ hooks/types): `player-placeholder` (live variant), `components/live-chat-placeholder.tsx`, and `components/sign-in-wall.tsx` (free-viewer-cap prompt using shadcn `card`/`button`)
- [ ] 2.4 Credits `app/credits/page.tsx` (+ hooks/types): balance (stub store), credit packages as shadcn `card`s with a coming-soon disabled `button`, and a placeholder history (shadcn `table` or list)

## 3. Account area

- [ ] 3.1 `app/account/page.tsx` (+ hooks/types): client-gate (redirect to `/login` when not authenticated via auth hook); show `avatar` (initials from display name), display name, email, and a credit summary linking to `/credits`
- [ ] 3.2 Edit forms (shadcn `input`/`label`/`button`, in `tabs` or `card` sections) for display name / email / password with stubbed submit handlers; delete-account using shadcn `alert-dialog` requiring explicit confirmation (stubbed action)

## 4. Studio area (owner-only placeholders)

- [ ] 4.1 `app/studio/layout.tsx`: `StudioShell` with `components/studio-sidebar.tsx` (shadcn `button`/links; mobile via `sheet`); client-gate with `useIsOwner()` (redirect non-owners)
- [ ] 4.2 `app/studio/page.tsx`: overview with placeholder summary `card`s linking to tools
- [ ] 4.3 `app/studio/upload/page.tsx`: upload dropzone shell (shadcn `card`) in disabled coming-soon state
- [ ] 4.4 `app/studio/live/page.tsx`: stream-setup shell (stream key area, shadcn `input` read-only) with start-stream `button` disabled
- [ ] 4.5 `app/studio/videos/page.tsx`: video list shell with placeholder rows and disabled row actions
- [ ] 4.6 `app/studio/settings/page.tsx`: channel settings form (shadcn `input`/`label`/`button`); stubbed submit

## 5. Polish & verify

- [ ] 5.1 Add `components/coming-soon.tsx` / `components/empty-state.tsx` shared placeholder components and use them consistently; ensure mobile nav (`sheet`) works across shells
- [ ] 5.2 `npx tsc --noEmit`, `npm run lint`, and `npm run build:local` all clean; fix any issues
- [ ] 5.3 Add/extend Playwright specs for nav + auth + that every route renders; run on request (user-run, no dev server started here)
