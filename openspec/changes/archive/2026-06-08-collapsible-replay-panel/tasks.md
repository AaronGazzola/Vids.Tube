## 1. ChatReplay component — collapse/expand

- [x] 1.1 Replace `ChatReplay`'s `onDismiss` prop with a `collapsed: boolean` plus `onCollapse`/`onExpand` (or a single `onToggle`) prop in `components/chat-replay.tsx`
- [x] 1.2 When expanded, render the existing panel but make the header control a collapse toggle with `aria-label="Collapse chat replay"`
- [x] 1.3 When `collapsed`, render only a compact re-expand control (labelled "Chat replay" with a chevron) with `aria-label="Show chat replay"`; do not render the message list
- [x] 1.4 Keep the component mounted in both states (no early return that unmounts the query consumer) so re-expand stays time-synced

## 2. Watch page — state, layout, persistence

- [x] 2.1 In `app/watch/[videoId]/page.tsx`, replace `replayDismissed` state with `replayCollapsed`, seeded expanded and hydrated from `localStorage` key `vodReplayCollapsed` in a post-mount `useEffect` (SSR-safe, avoids hydration mismatch)
- [x] 2.2 Persist `replayCollapsed` to `localStorage` whenever it toggles
- [x] 2.3 Drive the grid from collapse state: two columns (`lg:grid-cols-[1fr_340px]`) when expanded, single column (player full width) when collapsed; keep `ChatReplay` rendered in both states when replay exists
- [x] 2.4 Wire `ChatReplay`'s collapse/expand callbacks to toggle `replayCollapsed`

## 3. Tests & verification

- [x] 3.1 Extend `tests/e2e/live-vod.spec.ts`: on a VOD with replay, collapsing hides the message list but keeps a "Show chat replay" control; re-expanding restores the panel and its messages
- [x] 3.2 `npx tsc --noEmit` and `npm run lint` clean
- [x] 3.3 Run the e2e suite (`PLAYWRIGHT_PORT=3100 doppler run -- npx playwright test`) and confirm green
- [x] 3.4 `openspec validate collapsible-replay-panel --strict` passes
