## Context

`/watch/[videoId]` (`app/watch/[videoId]/page.tsx`) renders the player and, when the VOD has source-stream chat, the `ChatReplay` panel (`components/chat-replay.tsx`) in a two-column grid: `grid-cols-1 lg:grid-cols-[1fr_340px]`. Visibility is controlled by `replayDismissed` (a `useState(false)`); `ChatReplay`'s header X calls `onDismiss`, setting `replayDismissed = true`, which drops the panel and the grid collapses to one column for the rest of the session — with no way back.

The replay data flow (`useChatReplay` → `toReplayMessages` → `visibleReplayMessages`) and time-sync are unchanged by this work.

## Goals / Non-Goals

**Goals:**
- Reversible collapse/expand of the replay panel.
- Player reclaims width when the panel is collapsed.
- Collapsed/expanded preference persists across reloads and VOD navigations.

**Non-Goals:**
- No change to replay data, offsets, or time-sync logic.
- No change to the live chat panel (`components/live-chat.tsx`).
- No DB/schema/server changes.
- No per-account server-side persistence (local only).

## Decisions

- **Collapse, not unmount.** Replace `replayDismissed` with `replayCollapsed`. Both expanded and collapsed states keep replay mounted/queried so re-expand is instant and stays time-synced. The grid uses two columns when expanded (`lg:grid-cols-[1fr_340px]`) and a single column when collapsed, so the player goes full width.
  - *Alternative considered:* unmount the panel on collapse — rejected because re-expand would refetch/re-derive and lose scroll/sync continuity.
- **Collapsed affordance lives in `ChatReplay`.** `ChatReplay` gains a `collapsed` boolean plus `onCollapse`/`onExpand` (replacing `onDismiss`). When `collapsed`, it renders a compact control (a small labelled button / strip, e.g. "Chat replay" with a chevron) instead of the message list; when expanded, the header's X-style control becomes a collapse toggle. Keeping both states in one component keeps the watch page simple (it only owns the boolean + grid class).
  - *Alternative considered:* render the re-expand control directly in `page.tsx` — rejected to keep replay-panel presentation in one place.
- **Persist with `localStorage`** under a single key (e.g. `vodReplayCollapsed`), read on mount to seed initial state, written on toggle. Default = expanded when unset. Guard access for SSR (`typeof window`).
  - *Alternative considered:* cookie or Zustand `persist` — overkill for one boolean; `localStorage` matches the client-only, non-sensitive nature (and CLAUDE.md bars `persist` for sensitive data, which this is not).
- **Accessibility:** the collapse and re-expand controls get clear `aria-label`s ("Collapse chat replay" / "Show chat replay") so the e2e test and screen readers can target them by role+name.

## Risks / Trade-offs

- **Hydration mismatch** if initial render uses a `localStorage` value the server can't know → seed state as expanded and apply the stored preference in a `useEffect` after mount (or gate on a mounted flag), so SSR and first client render agree.
- **Stale preference across very different contexts** (collapsed everywhere once collapsed once) → acceptable and intended; it is a single global viewer preference, matching how YouTube-style chat toggles behave.
