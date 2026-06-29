## Why

Running a stream currently means juggling three studio pages: `/studio/overlay` to
configure (YouTube URL, goals, featuring toggle, OBS source URLs), `/studio/demo` to
preview the overlay layout, and `/studio/control` to actually operate (chat, read-this,
leaderboard, moderation). The owner wants **one** surface to manage and demonstrate the
live stream processes, with a **test mode** that exercises the whole thing against the
dry-run stream (`npm run dryrun`) instead of a separate mock simulation.

This change folds Setup and the overlay Preview into the control room and retires the two
standalone pages.

## What Changes

- **Setup section in the control room** — port the config controls from `/studio/overlay`
  into a collapsible "Setup" section on `/studio/control`: YouTube broadcast URL
  (`useSetStreamYoutubeVideo`), featuring on/off (`useSetScoringEnabled`), goal targets +
  Start-baseline (`useSetGoals` / `useStartGoals`), and the three copyable OBS source URLs
  (`/overlay/{slug}`, `/overlay/{slug}/goals`, `/overlay/{slug}/competition`). The modbot
  manual/auto toggle already lives in the control-room header and stays there.
- **Overlay preview stage in the control room** — port the draggable/resizable stage from
  `/studio/demo` (`DraggableResizable` + `HighlightedMessage` + `GoalBar` + `AvatarBubble`),
  but bound to the **current stream's real data** (`usePromotedMessages`,
  `useStreamStandings`, goals from `useOverlayContext`) rather than the demo's hand-driven
  mock viewers. Layout positions stay in local component state with a Reset button
  (persisting layout across reloads is AZ-136, out of scope).
- **Test-mode banner** — when the control room's active stream is the dry-run stream
  (detected by `streams.title` starting with `[DRY RUN]`, the marker
  `scripts/dryrun-stream.ts` already sets), show a banner stating data is simulated by
  `npm run dryrun`. This is purely an indicator; the data path is identical to live (the
  dry-run heartbeats a real `live` stream and runs the real scoring loop).
- **Retire the standalone pages** — `/studio/overlay` and `/studio/demo` become redirects
  to `/studio/control`, and their two sidebar entries are removed from
  `components/studio-sidebar.tsx` (the "Control room" entry stays). The reusable hooks that
  currently live in `app/studio/overlay/page.hooks.tsx` (`useOverlayContext`,
  `useViewerLeaderboard`, the setup mutations) remain where they are so imports don't churn;
  only the *page* is retired.

- **Out of scope**: persisting overlay layout (AZ-136); the demo's hand-driven mock
  simulation (replaced by dry-run data); any new overlay visuals; moderation engine changes.

## Capabilities

### Modified Capabilities

- `streamer-control-room`: becomes the single hub — gains a Setup section, an overlay
  Preview stage bound to live/test data, and a test-mode indicator; the standalone overlay
  config and demo pages are retired into it.

## Impact

- **DB**: none.
- **Routes retired**: `/studio/overlay`, `/studio/demo` (now redirect to `/studio/control`).
- **New files**: `app/studio/control/page.stores.ts` (preview layout local state) if needed;
  otherwise none.
- **Changed**: `app/studio/control/page.tsx` (+Setup, +Preview, +test banner);
  `app/studio/control/page.hooks.tsx` (import/reuse setup mutations + `usePromotedMessages`/
  `useStreamStandings`); `app/studio/overlay/page.tsx` and `app/studio/demo/page.tsx`
  (replace with redirects); `components/studio-sidebar.tsx` (remove two nav items).
- **Reuses**: `DraggableResizable`, `HighlightedMessage`, `GoalBar`, `AvatarBubble`,
  `useOverlayContext`, `useSetGoals`, `useStartGoals`, `useSetStreamYoutubeVideo`,
  `useSetScoringEnabled`, `usePromotedMessages`, `useStreamStandings`.
