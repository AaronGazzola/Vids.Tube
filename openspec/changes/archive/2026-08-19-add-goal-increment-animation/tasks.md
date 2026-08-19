# Tasks

## 1. Detecting a rise

- [x] 1.1 `lib/rise.ts`: `useRise(value, { enabled })` returning a token that changes only when `value`
      rises above the previous value. The first value seen SHALL set the baseline and return no token, so
      first paint is silent by construction rather than by a guard somewhere else.
- [x] 1.2 A fall SHALL update the baseline without producing a token, so a viewer count that dips and
      recovers to its old number animates on the way back up rather than staying silent forever.
- [x] 1.3 With `enabled` false the baseline SHALL still track the value, so leaving resize mode does not
      fire an animation for every rise that happened while it was on.
- [x] 1.4 `tests/unit/rise.test.ts`: first value silent; a rise produces a token; the same value again
      produces nothing; a fall produces nothing but rebases; a rise after a fall produces a token; a jump
      of ten produces exactly one token; while disabled nothing is produced and no rise is banked.

## 2. The animation

- [x] 2.1 Add one keyframes rule to `app/globals.css` for the rise, written with `0%`/`100%` stops. Not
      `from`/`to`: the CSS build drops those entirely and the animation silently never runs, which is
      already recorded in the comment above `overlay-message-out` in that same file.
- [x] 2.2 Transform and opacity only. Anything touching layout would relayout the overlay at the
      broadcast frame rate, and the box would move while it plays.
- [x] 2.3 In `components/overlay/goal-bar.tsx`, restart the animation on each token by keying the
      animated element on it, rather than by toggling a class — a class toggled back on before the
      previous run finished does not restart it.
- [x] 2.4 Size the animation from the `d` the component already computes from `height`, so it scales with
      the box the streamer sized rather than being fixed in pixels.
- [x] 2.5 Draw the animation in an absolutely positioned layer over the existing ring so the overlay's
      occupied space is unchanged while it plays.

## 3. Wiring it to the surfaces

- [x] 3.1 `components/overlay/overlay-stage.tsx` passes its `resizeMode` down to each `GoalBar` as the
      flag that suppresses animation. The stage already receives it; no new prop reaches the stage.
- [x] 3.2 Confirm by reading `app/(overlay)/overlay/[channelSlug]/page.tsx` that the OBS route passes no
      `resizeMode`, so the broadcast animates unconditionally and needs no change of its own.
- [x] 3.3 Demo mode feeds `goalMetric` from the demo snapshot rather than from the poll. **Recorded:**
      the demo values do rise. `tick()` in `app/(app)/live/demo.stores.ts` raises subs on roughly three
      ticks in ten and likes on six, and moves viewers up or down, so the demo animates for free and the
      falling viewer count exercises the silent-on-a-fall rule too.

## 4. Delete the dead rotation

- [x] 4.1 Remove the `@keyframes rainbow-spin` rule from `app/globals.css` and the `animation` line from
      `.rainbow-ring`. The rule is written with `to` alone, which the build drops, so the rotation has
      never run; the static conic gradient is the intended look and is unaffected.
- [x] 4.2 Confirm the reached-goal ring and the rank-one avatar ring both still draw their rainbow, since
      `.rainbow-ring` is used by `goal-bar.tsx` and `avatar-bubble.tsx` alike.

## 5. Cover it

- [x] 5.1 `tests/unit/goal-rise.test.tsx`: a rise adds the animated layer; an unchanged value does not; a
      fall does not; the first render does not; with the resize flag set a rise adds nothing.
- [x] 5.2 Assert the animated element's key changes between two successive rises, which is what proves a
      second rise restarts the animation rather than being swallowed.

## 6. Land it

- [x] 6.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 6.2 Run `openspec validate --strict` and archive.

## 7. Announcing the rise across the broadcast (amended after review)

The pulse-only animation this change first shipped was replaced. A rise is now
announced in the middle of the stream and delivered to its goal.

- [x] 7.1 `goalDiameter()` and `OVERLAY_CANVAS_CENTRE` lifted into
      `lib/demo-overlay.ts`, so the stage can locate a goal on the canvas without
      measuring the DOM. A measured pixel would be the wrong pixel on the
      Overlays tab, which scales the whole canvas to fit.
- [x] 7.2 `lib/goal-flight.ts`: `goalFlightDelta(box, height)` returning the
      travel from the canvas centre to the goal's drawn centre, accounting for
      the box's position and the scale the streamer set.
- [x] 7.3 `components/overlay/goal-rise-flyer.tsx`: message above, goal icon,
      number below. `riseBadge` decides what the number says — the increment for
      subs and likes, the total for viewers, because a viewer count is a level
      rather than a tally.
- [x] 7.4 One keyframes rule, `overlay-goal-flight`, driven by
      `--rise-cx/cy/dx/dy` set inline per flight, so one rule serves every goal
      wherever it sits. Transform and opacity only; `0%`/`100%` throughout.
- [x] 7.5 `lib/goal-flights.ts`: rises detected during render rather than in an
      effect, since they react to a value React already holds. Tracks flights in
      the air and a pulse token per goal.
- [x] 7.6 The pulse moved out of `GoalBar`'s own rise detection onto a
      `pulseToken` prop, so the goal reacts when the announcement lands rather
      than several seconds earlier when the number moved.
- [x] 7.7 Per-goal `animate` checkbox and `Demo` button in the Overlays panel;
      per-metric message inputs in the Settings goals section. Both stored on the
      layout, additive, no version bump.
- [x] 7.8 `tests/unit/goal-flight.test.ts` covers the geometry (centre, corner,
      scale, a moved goal) and the badge (increment for subs and likes, total for
      viewers, a grouped jump, separators). `tests/unit/goal-rise.test.tsx`
      rewritten for the token: silent at zero, pulses on a token, restarts on a
      second, and the overlay's own size is unchanged.
- [x] 7.9 **Decided 18-Aug-2026: rehearsal stays on the Overlays tab.** The demo button fires on the composer only, not on the OBS
      route. A one-shot event has no place in the demo snapshot, which is a
      picture of state rather than a stream of events, and the composer draws the
      same stage from the same values. Rehearsing on air was considered and is
      deliberately not wanted.
- [x] 7.10 `useGoalFlights` has no test of its own. The geometry and the badge wording are covered pure;
      the queueing, the landing and the rehearsal path need a seam before they can be. Moved to Linear as
      AZ-277 rather than left as an unchecked box.
