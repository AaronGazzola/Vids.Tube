## 1. FeaturedAvatar prop refactor

- [x] 1.1 `components/overlay/featured-avatar.tsx`: change props to `{ author: FeaturedAuthor | null; ringLevel: number; onDone: () => void }`; use `ringLevel` where `featured.ring_level` was and `author` where `featured.author` was
- [x] 1.2 Update the live call site `app/(overlay)/overlay/[channelSlug]/page.tsx`: `<FeaturedAvatar author={current.author} ringLevel={current.ring_level} onDone={...} />`

## 2. Draggable/resizable wrapper

- [x] 2.1 `components/draggable-resizable.tsx`: a client wrapper with `{ x, y, scale }` + `onChange`, children rendered at `left/top` + `transform: scale(...)`, a pointer-drag surface and a bottom-right corner resize handle (generalize the goal `DemoStage` pointer math; scale clamp 0.4–3)

## 3. VOD list (owner)

- [x] 3.1 `app/studio/demo/page.actions.ts`: `getOwnerVideosAction()` (owner-checked via the `getOwnedChannel` pattern) → the owner's `videos` where `status='ready'` (`id, title, mp4_path`), newest first
- [x] 3.2 `app/studio/demo/page.hooks.tsx`: `useOwnerVideos()` = `useQuery` calling the action

## 4. Demo page

- [x] 4.1 `app/studio/demo/page.tsx`: `useRequireOwner()`; a video dropdown (`useOwnerVideos`) + a `<video controls>` backdrop (`vodAssetUrl(mp4_path)`) filling a relative stage
- [x] 4.2 Simulation state: a roster of ~6 fake viewers (`{ id, author: FeaturedAuthor, score, features }`) mixing a Vids.Tube-style handle (channel-ish avatar) and YouTube-style names (`avatarUrl`); goal state `{ counts, baseline, goals }`; a featured-avatar play queue
- [x] 4.3 Three surfaces, each wrapped in `DraggableResizable`: Highlights (the `FeaturedAvatar` queue played one at a time), Goals (`GoalBar` per metric from `computeGoalProgress(counts, baseline, goals)`), Competition (`Plant` per roster viewer from their score, `topScore` = max)
- [x] 4.4 Control panel: "Feature a viewer" (bump features → enqueue a `FeaturedAvatar` with that `ringLevel`), per-viewer score +/-, goal current-count + target inputs + a "Start" (snapshot `baseline = counts`), and "reset layout" / "reset sim"

## 5. Studio nav

- [x] 5.1 `components/studio-sidebar.tsx`: add a "Demo" link (`/studio/demo`) with an icon

## 6. Verification

- [x] 6.1 `npx tsc --noEmit`, `npx eslint` (0 errors), `npm run build` pass; the live highlight overlay still builds with the refactored `FeaturedAvatar`
- [x] 6.2 `getOwnerVideosAction` typechecks against the `videos` schema and follows the owner-guard pattern (its live result needs an owner session — exercised in 6.3)

> Reconciliation (2026-07-04): removed 1 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
