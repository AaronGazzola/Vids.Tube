## 1. Data + dismiss state

- [x] 1.1 Add a `useYoutubeLinkStatus` hook (React Query wrapping the existing `getYoutubeLinkAction`) exposing `{ link, isPending }`, with `refetchOnWindowFocus` and a modest live-only `refetchInterval` so a mid-session verification is picked up.
- [x] 1.2 Add a non-persisted Zustand store (`*.stores.ts`) holding a per-user session dismiss flag for the banner, with a `dismiss(userId)` action and a selector.

## 2. Banner component

- [x] 2.1 Create the verify banner component. Render nothing unless the viewer is authenticated (`useAuthStore`) AND the link query resolved to `null` or `verified_at === null` AND not dismissed this session.
- [x] 2.2 Has-code state: show `verify_code` with a copy button + paste instruction and a regenerate control (`regenerateYoutubeCodeAction`), mirroring `YoutubeLinkCard` in `app/(app)/account/page.tsx`.
- [x] 2.3 No-link state: inline `@handle` input calling `saveYoutubeLinkAction` (surface expected-error strings via the existing toast plumbing), transitioning to the has-code state on success; include a deep link to the Account card.
- [x] 2.4 Add a dismiss control wiring the session store; ensure the banner unmounts when `verified_at` becomes non-null.

## 3. Mount + verify

- [x] 3.1 Mount the banner at the top of `components/live-chat.tsx`, directly under the "Live chat" header, so it sits above the message list without disrupting the sticky-scroll container.
- [ ] 3.2 `npm run build` + e2e; add a test asserting the banner shows for a signed-in unverified user, hides for a verified user and for anonymous visitors, and that dismiss hides it for the session.
