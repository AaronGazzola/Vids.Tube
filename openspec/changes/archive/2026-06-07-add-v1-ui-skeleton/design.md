## Context

vids.tube has functional auth (`@supabase/ssr` browser-client hooks), a
`channels` table with RLS, and a minimal public channel page. There is no
designed UI. This change adds the complete v1 UI skeleton for the single-channel
product, following `CLAUDE.md` conventions and the `docs/template_files/`
patterns. Only nav, theming, and auth are functional; everything else is a
styled, navigable placeholder.

## Goals / Non-Goals

**Goals:**
- shadcn/ui default look with a working light/dark toggle.
- A public app shell (top nav) and an owner-only Studio shell (sidebar).
- Root `/` renders the owner's channel; every v1 feature has a real route + UI.
- Restyled auth; stubbed credits/profile/studio/players/chat/payments.
- Architecture stays multi-channel-ready without building multi-channel features.

**Non-Goals:**
- No real backend for credits, profile persistence, uploads, live, chat, or
  payments (all stubbed this change).
- No schema/migration changes.
- No multi-channel UI (only the seam for it).
- No video/stream hosting.

## Decisions

- **Build from shadcn/ui wherever possible.** Every UI surface composes shadcn
  primitives (`button`, `card`, `input`, `label`, `dropdown-menu`, `avatar`,
  `dialog`, `tabs`, `badge`, `separator`, `tooltip`, `sheet`, `skeleton`,
  `sonner`). Custom components are thin compositions of these, not bespoke
  markup. Rationale: consistency, accessibility, and matches the user's request.

- **Theming without `next-themes`.** A small custom theme system: a client
  `ThemeProvider` (React context) toggles a `.dark` class on
  `document.documentElement` and persists to `localStorage`; a no-flash inline
  script is rendered in the **server** root layout to set the class before paint.
  Rationale: `next-themes` injected a `<script>` during client render, which
  React 19 / Next 16 flags ("script tag inside React component"). A server-
  rendered inline script is allowed and avoids the error. `components/ui/sonner.tsx`
  is repointed to read the theme from this provider instead of `next-themes`.
  Alternative considered: keep `next-themes` — rejected due to the console error.

- **App shell split.** Public layout = top nav only (`TopNav`: logo, `ThemeToggle`,
  `CreditsBadge`, `AccountMenu`). Studio layout = top bar + `StudioSidebar`.
  Implemented as Next.js route groups so each area has its own layout. Rationale:
  matches the YouTube / YouTube-Studio separation the user chose.

- **Root is the channel.** `/` renders the owner's channel (live banner + VOD
  grid). The slug route `/[channelSlug]` continues to exist for the multi-channel
  future; `/` fetches the single owner channel. Rationale: one channel today, no
  redundant landing page.

- **Owner gating via `useIsOwner()`.** Today returns "is authenticated" (single
  user). Structured to later become `channel.owner_user_id === user.id`. Studio
  routes and owner-only nav items use this hook. Rationale: the swappable seam
  keeps the app multi-channel-ready without building it now.

- **Stub pattern.** Placeholder pages render real layout + shadcn components in a
  disabled/`ComingSoon` state (e.g. an upload dropzone shell, a player frame, a
  chat panel) so they are visually complete and trivially wired up later.
  Stubbed data (credits balance/history, profile fields) comes from a small
  client store or constants — no DB calls.

- **File layout per CLAUDE.md.** Co-located `page.tsx` / `page.hooks.tsx` /
  `page.types.ts`; shared shell/store/types at the appropriate `layout.*` level;
  shared components in `components/`. No comments; `cn` from `@/lib/utils`;
  throw-on-error in any real logic.

## Risks / Trade-offs

- [Stubs drifting from real implementations] → Keep each stub's props/shape close
  to the eventual real component so wiring is a swap, not a rewrite.
- [Theme flash on first paint] → Mitigated by the server-rendered inline script
  that sets the class before React hydrates.
- [Owner gating is currently "any authed user"] → Acceptable for single-user v1;
  isolated in `useIsOwner()` so it changes in one place.
- [Verification without a dev server] → The user runs their own dev server; CI-
  style checks here are `tsc`, `lint`, and `next build`. E2E (Playwright) is run
  by the user or only on explicit request.

## Open Questions

- Whether profile display name should persist to Supabase `user_metadata` now or
  stay fully stubbed (currently stubbed).
- Exact credit package presentation on `/credits` (placeholder copy for now).
