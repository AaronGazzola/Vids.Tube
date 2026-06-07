## Why

vids.tube currently has working auth, a `channels` table, and a bare public
channel page, but no designed product UI — the home page is still Next.js
boilerplate. To move toward a usable v1, we need the full navigable UI for the
single-channel product, so every v1 feature has a real, styled place to live and
can be wired up incrementally.

## What Changes

- Add a **design system + theming**: shadcn/ui default styling with a working
  **light/dark toggle** (implemented without `next-themes`, which previously
  caused a script-tag console error).
- Add the **app shell**: a public top nav (logo, theme toggle, credits badge,
  account menu) and an owner-only **Studio** area with its own sidebar.
- Make the **root `/` the owner's channel** (live banner + VOD grid).
- Add all remaining v1 pages as **navigable, styled placeholders**: VOD watch,
  live watch (+ a free-viewer-cap sign-in wall), credits/top-up, account/profile
  (incl. delete account), and Studio tools (upload, go live, videos, settings).
- Restyle the existing auth pages to match the design system.
- **Constraint:** build the UI from **shadcn/ui components wherever possible**.
- **Functional now:** routing/nav, theming, and auth (existing). **Stubbed:**
  credits (display + placeholder history), profile edits, delete account, all
  Studio actions, players, chat, payments — UI only, no backend.
- Keep the architecture **multi-channel-ready** (owner gating via a swappable
  `useIsOwner` hook) without building multi-channel features now.

## Capabilities

### New Capabilities
- `app-shell`: navigation, theming + light/dark toggle, responsive layout,
  owner-gated UI, and the Studio shell — all built from shadcn/ui.
- `viewer-pages`: the channel home at `/`, VOD watch, live watch with a
  sign-in wall, and the credits page (placeholder content where backend is
  pending).
- `account`: the account/profile area, including stubbed profile fields and a
  delete-account flow.
- `studio`: the owner-only creator area with placeholder tools (upload, go live,
  videos, settings).

### Modified Capabilities
<!-- None. The existing `auth` and `channels` requirements are unchanged; auth
     pages are only restyled, and the slug-based channel page still exists. -->

## Impact

- New app code under `app/` (route groups for public, account, studio), shared
  `components/` (nav, theme, studio shell, video cards, player/chat placeholders,
  sign-in wall), and additional shadcn primitives.
- New dependency-free theme provider; `components/ui/sonner.tsx` repointed off
  `next-themes`.
- No schema changes (credits/profile are stubbed). No new backend.
- Establishes `useIsOwner()` as the seam for future multi-channel ownership.
