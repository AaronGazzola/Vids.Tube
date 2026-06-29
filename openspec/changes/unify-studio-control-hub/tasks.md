## 1. Setup section

- [x] 1.1 `app/studio/control/page.tsx`: add a collapsible "Setup" section (default
  collapsed) above the operating panels (`Collapsible` + `ControlSetup`)
- [x] 1.2 YouTube broadcast URL input wired to `useSetStreamYoutubeVideo()`; featuring
  on/off wired to `useSetScoringEnabled()` (both from `app/studio/overlay/page.hooks.tsx`)
- [x] 1.3 Goal target inputs (subs/likes/viewers) + Start-baseline button wired to
  `useSetGoals()` / `useStartGoals()`; current values from `useOverlayContext()`
- [x] 1.4 Three copyable OBS source URLs: `/overlay/{slug}`, `/overlay/{slug}/goals`,
  `/overlay/{slug}/competition` (`CopyRow`)

## 2. Overlay preview stage

- [x] 2.1 Port `PREVIEW_BOXES` + the draggable stage scaffolding from
  `app/studio/demo/page.tsx` into the control page (`OverlayPreview` in a "Preview"
  collapsible, default collapsed); box positions in local state with a Reset button
- [x] 2.2 Render `HighlightedMessage` (from `usePromotedMessages(streamId)`),
  `GoalBar` x3 (from `useGoalProgress(channelSlug)` — the same source the public goals
  overlay uses), and `AvatarBubble`s (from the leaderboard + `computeStandings`) inside
  `DraggableResizable` boxes
- [x] 2.3 Empty-state hint when no stream/data: "Go live or run `npm run dryrun` to populate
  the preview"
- [x] 2.4 Did NOT port the demo's mock viewers / manual bump buttons / opacity slider

## 3. Test-mode banner

- [x] 3.1 Added `streamTitle` to `OverlayContext` (`getOverlayContextAction` now selects
  `title`) so the control room has the active stream's title
- [x] 3.2 When `streamTitle` starts with `[DRY RUN]`, render `TestModeBanner`; otherwise none

## 4. Retire standalone pages

- [x] 4.1 Replaced `app/studio/overlay/page.tsx` body with `redirect("/studio/control")`;
  kept `page.hooks.tsx` and `page.actions.ts` intact (still imported by control)
- [x] 4.2 Replaced `app/studio/demo/page.tsx` body with `redirect("/studio/control")`;
  `useOwnerVideos`/`getOwnerVideosAction` were demo-only (grep-confirmed) so
  `app/studio/demo/page.hooks.tsx` and `page.actions.ts` were deleted
- [x] 4.3 `components/studio-sidebar.tsx`: removed the `/studio/overlay` and `/studio/demo`
  nav items (and now-unused `Sparkles`/`MonitorPlay` icons); "Control room" stays

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint app components` (0 errors), `npm run build:local`
  pass; `/studio/overlay` and `/studio/demo` still build (as redirect routes)
- [x] 5.4 `openspec validate unify-studio-control-hub --strict`

Owner-run visual checks (test banner + Setup + Preview fill against a `--youtube` dry-run;
old routes redirect; sidebar trimmed) tracked in Linear as AZ-138, not as build tasks.
