## 1. One overlay renderer, landed before anything moves

- [x] 1.1 Create `components/overlay/overlay-stage.tsx` exporting `OverlayStage`, holding the
      positioned-box layout and the per-overlay render currently inlined in
      `app/(overlay)/overlay/[channelSlug]/page.tsx`: the shared highlight/TTS/ask slot, the
      member strip, the goal boxes and the competition field. It takes the layout config, a
      resolved values object, and a `surface` of `"obs" | "composer"`.
- [x] 1.2 Define the resolved values object in `components/overlay/overlay-stage.types.ts`.
      Plain values — goal metrics, competition entries, member count — are passed as data.
      The shared feed slot and the break card are passed as rendered nodes instead, because
      each is stateful and behaves differently per caller: the live feed marks highlights
      shown and TTS played server-side and the demo feed marks nothing, and the demo break
      restarts itself while the live one runs to a fixed end time. Flattening either into
      data would have moved that behaviour into the renderer and made the two surfaces
      diverge inside it. A `wrapBox` render prop lets a caller wrap each positioned box
      without the other caller knowing.
- [x] 1.3 Rewrite `app/(overlay)/overlay/[channelSlug]/page.tsx` to resolve its existing
      queries and demo snapshot into that object and render `OverlayStage` with
      `surface="obs"`, keeping the current rule that a live demo snapshot overrides real
      values and the staleness timeout that drops it.
- [x] 1.4 Render the dashed "Highlight" placeholder only when `surface === "composer"`, so the
      OBS route continues to render nothing when the slot is idle.
- [x] 1.5 Confirm the existing overlay unit tests pass unchanged against the extracted
      renderer, adding no new assertions in this task, so the extraction is provably
      behaviour-preserving before the tab work begins.

## 2. The Overlays tab

- [x] 2.1 Add an `overlays` tab between Preview and Activity in the `TabsList` in
      `app/(app)/live/page.tsx`, with a matching `TabsContent`.
- [x] 2.2 Create `app/(app)/live/overlays-tab.tsx` exporting `OverlaysTab`, rendering the
      background chooser and slideshow controls lifted from `DemoPreviewStage`, the
      `OverlayStage` with `surface="composer"`, and the overlay control panel with its
      collapse button shown by default rather than gated on `panelOpen` being switched on.
- [x] 2.3 Add `app/(app)/live/overlays-tab.hooks.tsx` exporting `useOverlayComposerValues`,
      which resolves the same values object from the real queries the OBS route uses and
      returns empty values — zero counts, no slot item, empty leaderboard — when no broadcast
      is live.
- [x] 2.4 Move the mobile layout switch onto the Overlays tab, keeping the existing
      `setMobileChrome` store action as its source of truth.
- [x] 2.5 Delete `app/(app)/live/demo-preview.tsx` once `OverlaysTab` renders everything it
      provided, so no second overlay implementation remains.

## 3. Reduce the Preview tab

- [x] 3.1 In `app/(app)/live/page.tsx`, remove the `demo ? <DemoPreviewStage .../>` branch from
      the Preview `TabsContent` so the tab always renders the preview player, and remove the
      `!demo &&` guard on `TranscriptPanel` so the transcript always shows.
- [x] 3.2 Remove the "Edit overlays" button and the `editOverlays` state from the Preview tab,
      including the copy of both in the no-preview placeholder branch.
- [x] 3.3 Keep the mobile layout switch on the preview player and remove the playback health
      switch from the Preview tab, since the tab is specified as carrying only the preview,
      the transcript and the mobile layout toggle.
- [x] 3.4 Delete `app/(app)/live/overlay-editor.tsx`, whose ghost-outline canvas is replaced by
      containers drawn around the real overlays.

## 4. Resize and reposition mode

- [x] 4.1 Add `resizeMode` to the toolbar state in `app/(app)/live/demo.stores.ts` as session
      state with a `false` default, excluded from the persisted layout config so it is never
      saved and never sent to OBS.
- [x] 4.2 Add the resize switch to the Overlays tab control panel, bound to `resizeMode`.
- [x] 4.3 Create `components/overlay/overlay-container.tsx` exporting `OverlayContainer`, which
      wraps a positioned overlay and renders a visible border plus four corner handles only
      when `resizeMode` is on, attaching no pointer handlers when it is off.
- [x] 4.4 Implement dragging on the container body to change the box's `x`/`y`, reusing the
      pointer-capture approach from the deleted editor's `startDrag`.
- [x] 4.5 Implement corner resizing: on pointer down record the pointer's distance from the
      opposite corner and the box's starting `scale`; on move set `scale` to the starting
      scale multiplied by the ratio of current to starting distance, clamped to the existing
      bounds, so the opposite corner stays fixed and aspect ratio is preserved.
- [x] 4.6 Add `tests/unit/overlay-resize.test.ts` asserting that the scale computation anchors
      the opposite corner for each of the four handles, that it is clamped at both bounds, and
      that width and height change in the same proportion.

## 5. Bitmap content matched to rendered size

- [x] 5.1 Add `lib/avatar-size.ts` exporting `avatarSizeBucket(renderedPx, devicePixelRatio)`,
      returning the next bucket at or above the required pixels from a fixed ascending list.
- [x] 5.2 Apply the bucket to avatar URLs rendered inside `OverlayStage` by rewriting the
      existing size token, so both the OBS route and the Overlays tab request a matched size.
- [x] 5.3 Hold the bucket monotonically during a drag and settle it on pointer up, so an
      overlay dragged inward and outward never re-requests a smaller image mid-drag.
- [x] 5.4 Add `tests/unit/avatar-size.test.ts` covering bucket selection at and between
      boundaries, a device pixel ratio above one, and the monotonic-during-drag rule.

## 6. Demo, goal-reached and the OBS scope

- [x] 6.1 Move the Demo switch out of the header in `app/(app)/live/page.tsx` and into the
      Overlays tab control panel, keeping its ephemeral off-on-load behaviour.
- [x] 6.2 Add a `goalReached` toggle beside it that makes the demo generator report every goal
      metric at or above its target, so the reached state renders through the same path real
      metrics use.
- [x] 6.3 Add a `demoToObs` checkbox, defaulting off, and gate the existing demo snapshot
      broadcast on it so that nothing is sent while it is off and OBS returns to real values
      through the existing staleness timeout.
- [x] 6.4 Show a plain warning beside the checkbox whenever it is on while the active stream is
      live, stating that viewers are seeing invented values, without disabling the control.
- [x] 6.5 Keep the Go live, End stream and Discard controls available while demo is on, and
      keep the Demo indicator in the status toolbar.
- [x] 6.6 Not needed, and deliberately not done. The task assumed the new flags would be
      persisted. They are not: demo, goal-reached scope, the OBS checkbox and resize mode are
      all session state, so the saved layout's shape is unchanged and `DEMO_LAYOUT_VERSION`
      stays as it is. Bumping it would run the reset machinery over an unchanged shape for no
      gain, which is the exact risk the task was written to avoid.

## 7. The Activity tab's own demo toggle

- [x] 7.1 Add an `activityDemo` flag to the toolbar state, off on load and independent of the
      Overlays tab's demo flag.
- [x] 7.2 Add a demo toggle to the Activity tab header and drive `DemoActivity` and
      `DemoActivityIndicators` from `activityDemo` instead of the removed global flag.
- [x] 7.3 Hide the pop-out icon on the Overlays tab and keep it hidden on Settings, leaving it
      on Preview and Activity as today.

## 8. Prove it

- [x] 8.1 Add `tests/unit/overlay-stage-parity.test.tsx` rendering `OverlayStage` once with
      `surface="obs"` and once with `surface="composer"` from the same values object, and
      asserting the two differ only by the composer placeholder.
- [x] 8.2 Add `tests/unit/overlay-composer-empty.test.tsx` asserting that with no live
      broadcast every overlay renders its empty state and that no demo value appears.
- [x] 8.3 Add `tests/e2e/overlays-tab.spec.ts` asserting that the Overlays tab opens with the
      panel shown and no containers visible, that turning the resize switch on reveals four
      corner handles on each visible overlay, that dragging a corner changes size without
      changing aspect ratio, and that turning the switch off makes dragging inert.
- [x] 8.4 In that spec, assert the Preview tab shows the player and transcript and carries no
      overlay stage or "Edit overlays" control.
- [x] 8.5 In that spec, restore the owner's saved layout after the run, following the pattern
      the existing overlay specs use, so a test never costs the owner their positions.

## 9. Land it

- [x] 9.1 Update `openspec/specs/live-demo-mode/spec.md` references in `docs/` where the Demo
      switch is described as living in the tab bar.
- [x] 9.2 Run `openspec validate --strict` and archive.
