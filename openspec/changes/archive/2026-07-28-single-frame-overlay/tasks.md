## 1. Data model

- [x] 1.1 Migration `rename_overlay_layouts`: rename `demo_layouts` →
  `overlay_layouts`; add `token text not null` with a random md5 default;
  push to prod; regen types.
- [x] 1.2 `demo.types.ts`: add `competitionOpacity: number` (default 0.6) and
  `feedSound: "chime" | "off"` (default "chime") to `DemoLayoutConfig`;
  `mergeDemoLayout` fills defaults for old configs.

## 2. Actions + realtime

- [x] 2.1 `demo.actions.ts`: point layout read/save at `overlay_layouts`; add
  `getOverlayUrlInfoAction` (ensures a row exists, returns `{ token }`) and
  `regenerateOverlayTokenAction`.
- [x] 2.2 `overlay/[channelSlug]/page.actions.ts`:
  `getOverlayLayoutAction(channelSlug, token)` returns the config only when
  the token matches; null otherwise.
- [x] 2.3 `lib/demo-overlay.ts`: `overlayLayoutChannelName(slug)`; frame
  subscribes to broadcast config updates; `useDemoLayout` broadcasts the
  config (debounced) after hydration whenever it changes.

## 3. Frame route

- [x] 3.1 Rewrite `overlay/[channelSlug]/page.tsx` as the single frame:
  fixed 1080×1920 canvas; feed slot, goalSubs/goalLikes/goalViewers,
  competition (config opacity), break — each absolutely positioned at its
  box `x/y/scale`, hidden per `visible`; token-gated; demo snapshots render
  in the same positions; feed chime gated by `feedSound`.
- [x] 3.2 Delete the per-element routes: `competition/page.tsx`,
  `break/page.tsx`, `goals/page.tsx`, `goals/[metric]/` (hooks/actions files
  stay).

## 4. Editor + settings

- [x] 4.1 New `overlay-editor.tsx` on the Preview tab (non-demo): measured
  9:16 stage over the live player; draggable/resizable labeled outline boxes
  writing the layout store; controls popover with per-element switches,
  competition opacity slider, feed sound select, reset, copy URL.
- [x] 4.2 `settings-tab.tsx`: replace the six CopyRows + opacity slider with
  one tokened URL row + Regenerate token.
- [x] 4.3 `page.tsx` (/live): mount the layout broadcast; keep
  `useDemoLayout(true)` persistence active outside demo mode.

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
- [x] 5.2 Programmatic check: overlay_layouts row has token; frame action
  returns config with correct token and null with a wrong token.
