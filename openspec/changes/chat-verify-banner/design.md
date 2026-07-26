## Context

- The verify flow is fully built: `getYoutubeLinkAction` / `saveYoutubeLinkAction` / `regenerateYoutubeCodeAction` / `unlinkYoutubeAction` in `app/(app)/account/page.actions.ts`, worker matching in `worker/lib/verify-links.ts`, and the `YoutubeLinkCard` UI in `app/(app)/account/page.tsx`. It has 0 verified links because it is only reachable from the Account page.
- `components/live-chat.tsx` renders the chat panel; it already reads `isAuthenticated` from `useAuthStore`. The banner mounts directly under its "Live chat" header (line ~23).
- `youtube_links` RLS is self-read only; all writes go through the service-role actions. No schema change is needed.

## Goals / Non-Goals

**Goals:**

- Put the verify affordance in the chat panel for signed-in, unverified users, mirroring `YoutubeLinkCard` behavior.
- Support both the has-code and no-link-yet states inline.
- Hide reactively when `verified_at` is set; dismiss per session.

**Non-Goals:**

- Any change to the verification mechanism, worker, or `youtube_links` schema.
- Google/OAuth linking (AZ-152).
- The unclaimed-channel "Claim this profile" entry point (AZ-170) — a parallel, separate surface for the same flow.

## Decisions

### D1 — Data via a dedicated hook over the existing action

A `useYoutubeLinkStatus` hook wraps `getYoutubeLinkAction` (React Query). The banner renders only when `isAuthenticated` AND the query has resolved to `null` or `verified_at === null`. Loading renders nothing (no skeleton — the banner is supplemental, not core content). Reusing the existing action keeps one source of truth and avoids new server surface.

### D2 — Two states in one component

- **No link yet** (`getYoutubeLinkAction` → null): an inline `@handle` input calling `saveYoutubeLinkAction`; on success the component transitions to the has-code state showing the returned code. A secondary link deep-links to the Account card for users who prefer the full UI.
- **Unverified link** (`verified_at === null`): show the `verify_code` with a copy button and the instruction "Paste this code into the YouTube live chat to link your YouTube history," plus a regenerate control (`regenerateYoutubeCodeAction`), matching `YoutubeLinkCard`.

### D3 — Reactive hide on verification

The worker sets `verified_at` out of band. Rather than add a realtime subscription, the hook refetches on window focus and on an interval while a stream is live (React Query `refetchInterval`), so a mid-session verification clears the banner within one poll. This matches the existing polling cadence of the chat surface and avoids a new subscription. When `verified_at` becomes non-null the banner unmounts.

### D4 — Per-session dismiss

A dismiss control sets a session-scoped flag (Zustand store, non-persisted, keyed by the user id) so the banner hides for the session and reappears next visit until verified. Non-persisted per CLAUDE.md (no `persist` for user data) and because "reappears next stream until verified" is the intended nudge cadence.

## Risks / Trade-offs

- [Banner nags verified users if the query is stale] → the visibility predicate keys on `verified_at`; a stale null resolves on the next focus/interval refetch, and dismiss covers the gap.
- [Inline handle entry duplicates `YoutubeLinkCard` logic] → the component calls the same actions; only the presentation is new, and a deep link to the card remains for the full flow.
- [Polling adds requests] → bounded to focus + a modest live-only interval; negligible next to the chat stream itself.

## Open Questions

None. The exact copy and the regenerate affordance mirror `YoutubeLinkCard`; final wording is a UI detail.
