## Context

The renderer treats an absent value as an instruction to render nothing. Goal bars return early
when there is no active goal data, the leaderboard is guarded on having at least one entry, and
the break card is only passed when a break is set. On the audience surface that is right: a
viewer must not see an empty leaderboard frame. On the composer it means most of the layout is
invisible exactly when the owner wants to arrange it.

The highlight slot has the opposite fault. Its dashed placeholder renders whenever the slot is
empty on the composer, so the one overlay that is genuinely event-driven is permanently on
screen.

There is also a smaller inherited fault. When no broadcast is live, the audience surface draws
idle goal bars against `DEFAULT_GOALS` — a hardcoded 1000/500/100 — rather than the targets the
owner saved on the Settings tab. Composing against those bars means composing against numbers
nobody chose.

## Goals / Non-Goals

**Goals:**

- Every visible overlay is on screen and positionable whenever the tab is open.
- What is on screen is the truth: real values during a broadcast, real emptiness before one.
- Idle goal bars read against the owner's own targets, on both surfaces.
- The audience surface keeps rendering nothing when idle.

**Non-Goals:**

- Changing any overlay's visual design.
- Changing what the audience sees, beyond correcting which targets idle goal bars use.
- Adding new overlays or new values.

## Decisions

### Absence is rendered, not hidden — on the composer only

The renderer stops short-circuiting on an absent value and instead asks the surface what to do.
The composer renders the empty form; the audience surface keeps its current behaviour of
rendering nothing.

This is a deliberate divergence between the two surfaces, and the first one this renderer has.
It is justified because the surfaces have genuinely opposite requirements here: the composer
exists to show what is there including nothing, and the audience must never see an empty frame.
The divergence is confined to whether a box renders at all — the box's contents are still drawn
by the same components from the same values.

*Alternative considered:* render empty forms on both surfaces. Rejected outright: it would put
an empty leaderboard on the broadcast.

### Event-driven overlays have no idle form, and rely on resize mode instead

Goal bars have a meaningful zero. A leaderboard has a meaningful empty. The highlight slot and
the break card do not: an idle highlight is not a highlight, and a break that is not running is
not a break. Inventing a resting state for them would be inventing data.

Those two therefore stay invisible when idle, on both surfaces, and are made positionable by
resize mode rather than by a placeholder.

### Resize mode guarantees every visible overlay a grabbable box

An overlay rendering nothing has no size, so its container would collapse and could not be
dragged. While resize mode is on, every container carries a minimum size and a label, so an
empty leaderboard, an idle break card and an empty highlight slot can all be positioned.

This is also what the dashed "Highlight" placeholder becomes: it stops being an always-on hint
and becomes part of resize mode, which is where positioning happens.

### Idle goal bars use the owner's saved targets

`idleProgress` already takes a target, so the fix is to pass the targets from the Settings tab
rather than the hardcoded defaults, falling back to the defaults only when nothing is saved.

Applied to the audience surface as well as the composer. Leaving them different would mean
composing against bars that read one thing and broadcast bars that read another, which defeats
the point of composing against real values.

### The panel is toggled from the tab row

The button moves off the stage and into the header beside the tabs, as an icon with an active
state. It sits with the other page-level controls rather than floating over the thing being
composed, and it no longer disappears behind the panel it opens.

## Risks / Trade-offs

- [The two surfaces now differ, and could drift further] → The difference is a single decision
  passed in as the surface, applied at one place per overlay, and asserted by the existing
  parity test which is extended to cover both behaviours from the same values.
- [Idle goal bars change what viewers see when not live] → They change from arbitrary defaults
  to the owner's own targets, which is a correction. Worth watching on the first broadcast.
- [A minimum container size could misrepresent where a large overlay actually sits] → The
  minimum applies only while resize mode is on and only to a box that would otherwise be
  zero-sized, so a rendered overlay is never resized by it.
