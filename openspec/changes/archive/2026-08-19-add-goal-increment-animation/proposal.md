## Why

The goal overlays update their numbers silently. A new subscriber arrives, a viewer joins, someone likes
the broadcast, and the figure changes with nothing to draw the eye. The moment the whole overlay exists
to celebrate passes unmarked on the broadcast.

## What Changes

- A goal overlay plays an animation when its metric rises: subscribers, likes and viewers, the three
  metrics the goal overlays carry.
- The trigger is the value rising, not a poll returning. The goals are polled every ten seconds, and a
  poll that reports the same number animates nothing.
- Nothing animates on first paint, when every value arrives at once from nothing rather than by rising.
- Nothing animates on the Overlays tab while the streamer is arranging boxes, or dragging a box becomes a
  light show.
- The animation is sized against the 1080x1920 canvas at broadcast scale, not against a desktop preview,
  and it scales with the box the streamer sized.
- The dead `rainbow-spin` rotation is deleted. It never ran, because the CSS build drops `from`/`to`
  keyframes and that rule is written with `to` alone. The reached-goal ring is a static rainbow today and
  is meant to stay one, so the keyframes and the `animation` line that references them are removed rather
  than repaired.

## Capabilities

### Modified Capabilities

- `goal-overlays`: a goal overlay marks a rise in its metric with an animation, on the broadcast and in
  the composer, and never on first paint or while a layout is being arranged.

## Impact

- `components/overlay/goal-bar.tsx` gains the animation and the rise detection it needs.
- `app/globals.css` gains one keyframes rule written as `0%`/`100%`, and loses the dead `rainbow-spin`
  rule and its `animation` line on `.rainbow-ring`.
- `components/overlay/overlay-stage.tsx` passes the composer's arranging state down, which it already
  holds as `resizeMode`.
- **Not in this change:** the message banner's own counts, which are not goal overlays; a sound on a
  rise; a distinct animation when a goal is reached; and any change to how often the goals are polled.
