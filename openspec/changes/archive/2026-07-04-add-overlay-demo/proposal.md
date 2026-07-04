## Why

The whole overlay stack (highlights, goals, competition) is built but has never run
end to end — the AI loop only comes alive during a real broadcast. Before going live,
the owner needs to *see* the overlays over real footage, position and size them for
OBS, and watch each event animate. This change adds an owner-only demo harness that
plays one of the owner's past VODs and lays the **real** overlay components on top
with drag/resize and client-side event simulation — so the visuals and layout are
verified with confidence, no live stream required.

## What Changes

- **Owner-only `/studio/demo` page** (no migration, no DB writes, no worker, no
  YouTube — all simulation is client state). A "Demo" link is added to the studio
  sidebar.
- **VOD backdrop**: `getOwnerVideosAction()` lists the owner's ready videos; a dropdown
  picks one and it plays in a `<video controls>` (`vodAssetUrl(mp4_path)`) filling the
  stage.
- **Draggable/resizable surfaces**: a reusable `components/draggable-resizable.tsx`
  (generalized from the goal DemoStage drag/resize) wraps each overlay surface so the
  owner can reposition and scale Highlights, Goals, and Competition independently over
  the video.
- **Real components, simulated data**: the demo renders the actual `FeaturedAvatar`,
  `GoalBar`, and `Plant` components fed by client state — a queue of featured avatars,
  `computeGoalProgress` over simulated counts, and `plantShape` over a simulated viewer
  roster.
- **Control panel** to simulate events: a roster of fake viewers (a mix of Vids.Tube-
  style handles and YouTube-style names with avatars); "Feature a viewer" (animates an
  avatar with the right ring count), per-viewer score +/- (grows/shrinks plants), and
  goal current-count/target inputs with a "Start" baseline snapshot (so the goal math
  matches production). Reset controls for layout and the simulation.
- **`FeaturedAvatar` refactor**: it now takes `{ author, ringLevel, onDone }` instead
  of the full `featured_messages` row, decoupling the visual from the DB row so both the
  live overlay and the demo can construct it; the live overlay call site is updated.

- **Out of scope**: validating the `claude -p` scoring **decisions** (the demo verifies
  rendering/layout/animation only — AI quality still needs the live run, AZ-127);
  persisting layouts; in-site (watch page) overlays.

## Capabilities

### New Capabilities

- `overlay-demo`: the owner-only demo harness — VOD playback backdrop, the
  draggable/resizable overlay surfaces driven by simulated events, and the control
  panel — for visual verification of the overlay stack before going live.

### Modified Capabilities

(none — `FeaturedAvatar`'s prop change is an internal refactor, not a spec-level
requirement change to the featured-overlay behavior.)

## Impact

- **DB**: none. No migration. Reads the owner's `videos` (already owner-readable) for
  the VOD list.
- **New files**: `app/studio/demo/{page.tsx,page.hooks.tsx,page.actions.ts}`;
  `components/draggable-resizable.tsx`; small edits to
  `components/overlay/featured-avatar.tsx`, `app/(overlay)/overlay/[channelSlug]/page.tsx`,
  and `components/studio-sidebar.tsx`.
- **Reuses**: `FeaturedAvatar`/`GoalBar`/`Plant`, `computeGoalProgress` + `plantShape`,
  `FeaturedAuthor`, `vodAssetUrl`, the `videos` table, `useRequireOwner`, and the goal
  DemoStage drag/resize logic.
- No changes to live overlay, scoring, goal, or competition behavior.
