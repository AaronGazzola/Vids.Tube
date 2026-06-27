## Why

The first look at the overlays surfaced concrete UX direction: the "feature" highlight
just shows a name, the competition plants aren't the wanted visual, and the demo can't
position elements individually or simulate the full live UX. This change redesigns the
overlay visuals to their intended form and upgrades the demo so the owner can verify
the whole experience (including how the AI will drive it) before going live.

## What Changes

- **Rank-aware avatar bubble** (`components/overlay/avatar-bubble.tsx`): an avatar with a
  circular progress ring (fills to `score / leaderScore`; full for first place) and a
  1/2/3 rank badge. Ring + badge colors: gold (1st), silver (2nd), bronze (3rd),
  translucent gray otherwise. Shared by the competition and highlight overlays.
- **Competition = floating bubbles** (replaces the plants): every viewer with a score
  appears as a low-opacity avatar bubble drifting in the **bottom third** of the screen,
  ring + badge per the above. `Plant`/`lib/plant.ts` are removed.
- **Highlighted message card** (`components/overlay/highlighted-message.tsx`, replaces the
  fly-across name): the author's avatar bubble (with ring + badge) on the left, `@handle`
  and name beneath it, and a speech bubble to the right showing **what they said**, with
  a tail pointing at the avatar.
- **Message text on `featured_messages`**: add a `body` column so the highlight can show
  the actual message; the scoring engine writes it.
- **Demo upgrade** (`/studio/demo`): a **portrait** stage; each overlay element is
  **individually** draggable/resizable; and a fuller simulation — post a chat message as
  a viewer, have it highlighted (message card), and watch scores accrue into the floating
  bubbles — so the full live UX can be walked through.

- **Out of scope**: the standalone chat overlay (AZ-131); bonsai/betting (AZ-107);
  persisting OBS layout.

## Capabilities

### New Capabilities

- `overlay-bubbles`: the rank-aware avatar bubble + the floating-bubbles competition
  overlay (replacing the plant competition).
- `overlay-highlight-card`: the highlight message card (author bubble + speech bubble
  with the chat text) and the `featured_messages.body` text it reads.
- `overlay-demo-sim`: the upgraded demo — portrait stage, per-element positioning, and
  full-UX event simulation.

### Modified Capabilities

(none in `openspec/specs/` — the prior overlay/demo specs live in still-active changes;
this change supersedes their visuals via new requirements.)

## Impact

- **DB**: one migration adding `featured_messages.body text` (nullable). Production push
  needs owner OK; `npm run db:types` after.
- **New files**: `components/overlay/avatar-bubble.tsx`,
  `components/overlay/highlighted-message.tsx`, `lib/standings.ts` (rank/progress helper);
  rainbow-free bubble float keyframes in `app/globals.css`.
- **Changed**: competition route → floating bubbles; highlight route + `FeaturedAvatar`
  → message card; `worker/jobs/score.ts` writes `body`; `app/studio/demo/page.tsx`
  rebuilt; sidebar unchanged.
- **Removed**: `components/overlay/plant.tsx`, `lib/plant.ts`, the plant scenarios.
- **Reuses**: `viewer_scores`, `FeaturedAuthor`/`lib/featured-author.ts`,
  `channelAssetUrl`, the transparent `(overlay)` group, `DraggableResizable`.
