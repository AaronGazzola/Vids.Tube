## 1. Absence renders on the composer, not on the audience surface

- [ ] 1.1 Add `renderEmpty: boolean` to `OverlayStageValues` consumers by deriving it from
      `surface` inside `components/overlay/overlay-stage.tsx`: true for `"composer"`, false for
      `"obs"`. No caller passes it, so the two surfaces cannot be configured apart by accident.
- [ ] 1.2 In `OverlayStage`, stop returning early on an absent goal metric. Render the goal bar
      whenever its box is visible and either a metric resolves or the surface renders empties,
      using a zero metric against the box's target when none resolves.
- [ ] 1.3 In `OverlayStage`, drop the `competitionEntries.length > 0` guard when the surface
      renders empties, so the leaderboard draws its empty frame on the composer and stays
      absent on the OBS route.
- [ ] 1.4 Leave the highlight slot and the break card rendering nothing when idle on both
      surfaces, since neither has a resting state.

## 2. Goal bars read the owner's targets

- [ ] 2.1 In `app/(app)/live/overlays-tab.hooks.tsx`, take the saved goal targets as an argument
      and resolve each metric as: the active goal metric when a broadcast is live, otherwise
      `idleProgress` against that saved target, falling back to `DEFAULT_GOALS` only when no
      target is saved.
- [ ] 2.2 In `app/(overlay)/overlay/[channelSlug]/page.tsx`, replace
      `idleProgress(DEFAULT_GOALS[m])` with the channel's saved targets on the same fallback
      basis, so an idle bar reads the same on both surfaces.
- [ ] 2.3 Pass the Settings tab's goal targets into `OverlaysTab` from `app/(app)/live/page.tsx`
      as the source for 2.1, rather than the demo targets it currently passes for demo use.

## 3. The placeholder belongs to resize mode

- [ ] 3.1 Add `resizeMode: boolean` to `OverlayStageProps` and render the dashed placeholder only
      when the surface is the composer and resize mode is on.
- [ ] 3.2 Pass `resizeMode` from `app/(app)/live/overlays-tab.tsx`, which already reads it from
      the store.
- [ ] 3.3 In `components/overlay/overlay-container.tsx`, apply a minimum width and height while
      the container is active, so an overlay rendering nothing is still grabbable, and confirm
      the minimum never enlarges a container that already has size.
- [ ] 3.4 Show the overlay's label inside the container while resize mode is on, so an empty
      box says which overlay it is.

## 4. The panel moves to the tab row

- [ ] 4.1 Remove the "Overlays" text button drawn on the stage in
      `app/(app)/live/overlays-tab.tsx`.
- [ ] 4.2 Add an icon button to the right of the `TabsList` in `app/(app)/live/page.tsx`, shown
      only on the Overlays tab, bound to `panelOpen`, carrying an active state while the panel
      is open and an accessible name that says which action it performs.

## 5. The header reflows

- [ ] 5.1 In `app/(app)/live/page.tsx`, let the header wrap so the tab list takes its own line
      on a narrow viewport and shares a line on a wide one, without clipping any control.

## 6. Prove it

- [ ] 6.1 Extend `tests/unit/overlay-stage-parity.test.tsx` so the same empty values render an
      empty leaderboard and a zero goal bar on the composer and neither on the OBS route.
- [ ] 6.2 Update `tests/unit/overlay-composer-empty.test.tsx` for the new behaviour: goal bars
      present at zero against supplied targets, leaderboard frame present, highlight and break
      absent, and no placeholder while resize mode is off.
- [ ] 6.3 Add to `tests/e2e/overlays-tab.spec.ts`: with nothing live, the goal bars and the
      leaderboard are visible with resize mode off, and the highlight placeholder is not.
- [ ] 6.4 In that spec, assert the panel icon beside the tabs toggles the panel and reflects its
      state, and that no panel button is drawn over the stage.
- [ ] 6.5 In that spec, assert every overlay has a grabbable container at a narrow viewport with
      resize mode on, and that the tabs sit above the other header controls there.

## 7. Land it

- [ ] 7.1 Run `openspec validate --strict` and archive.
