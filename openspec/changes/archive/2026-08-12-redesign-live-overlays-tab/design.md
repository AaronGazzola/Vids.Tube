## Context

The /live page has three tabs and a global Demo switch in its header. The switch changes what
two of the three tabs show, so it is effectively a mode, not a setting. On the Preview tab it
replaces the encoder preview with a demo stage; on the Activity tab it replaces the real
activity feed with a simulated one.

Overlay layout is edited from a button floating over the preview video. The editor draws ghost
outlines on a scaled canvas, each carrying a single bottom-right handle that changes a uniform
`scale` value on drag. The outlines are not the overlays; they are stand-ins with the same
nominal dimensions.

Three renderings of the same overlays exist today:

- the OBS route, which renders real values and already accepts a demo snapshot as an override;
- the demo stage on the Preview tab, which reimplements the overlays with generated values;
- the editor's ghost outlines, which reimplement only their bounding boxes.

Keeping the first two in step is currently a spec requirement in its own right, which is a
sign the duplication is the problem rather than something to manage.

Two transports already exist and are easy to confuse:

- the **layout config**, holding boxes, visibility, opacity and messages, which is saved
  debounced and pushed to OBS by realtime;
- the **demo snapshot**, a separate realtime broadcast carrying demo boxes, visibility and
  metrics, which the OBS route treats as an override and drops after a staleness timeout.

## Goals / Non-Goals

**Goals:**

- Give the encoder preview and overlay composition a tab each, with no mode switch between.
- Compose overlays against their real current values, so what is positioned is what viewers see.
- Make resizing obviously available or obviously unavailable, never ambiguous.
- Preserve aspect ratio by construction rather than by validation.
- Keep one rendering of the overlays, so parity is structural.

**Non-Goals:**

- Changing what any overlay looks like, or which overlays exist.
- Changing the overlay data model beyond the flags this change needs.
- Changing how OBS receives layout or demo data; both transports stay as they are.
- Per-overlay demo states. Demo and goal-reached are global, by decision.
- Reworking the Activity tab beyond giving it its own demo toggle.

## Decisions

### One overlay renderer, parameterised by data source

The overlays are extracted into a single renderer that takes a data source and renders boxes
from a layout config. The OBS route and the Overlays tab both use it; the demo stage's
reimplementation is deleted.

The data source is either the real queries or the demo generator, chosen by the caller. The OBS
route keeps its existing rule that a live demo snapshot overrides real values.

*Alternative considered:* leave the two renderings separate and add a third for the tab.
Rejected because the parity burden already needed a spec requirement to hold it together, and a
third copy would make composing against real values a lie the moment the copies drift.

*Consequence:* this is the largest and riskiest part of the change, and it is what makes
"overlays showing their current real values" true rather than approximate.

### The tab renders empty overlays when nothing is live

No fallback to the last broadcast and no automatic demo. An overlay with no current value
renders in its real empty state: zero counts, no featured message, an empty leaderboard.

*Rationale:* the tab's purpose is to show what viewers would see. A populated-looking tab that
is quietly showing yesterday's numbers would defeat that, and the Demo switch already covers
the case of wanting something to look at.

### Corner handles drive the existing uniform scale

Each overlay's container gets four corner handles. A drag computes the pointer's distance from
the **opposite** corner and sets `scale` to the ratio of that distance to its value at drag
start, clamped to the existing bounds. The opposite corner therefore stays put and the box
grows or shrinks about it.

Because a single scalar drives both dimensions, aspect ratio cannot be violated, and no
validation or snapping is needed.

*Alternative considered:* independent width and height with content fitted inside. Rejected: it
changes the data model, introduces letterboxing inside overlays, and buys framing flexibility
nobody asked for.

### Resize mode is view state, not saved state

The switch showing containers is per-session UI state. It is not written to the layout config
and does not reach OBS.

*Rationale:* it describes what the operator is doing right now, not how the overlays are
configured. Persisting it would mean an overlay layout could be saved "in edit mode".

While the switch is off, containers are not rendered and no pointer handlers are attached, so
overlays cannot be dragged or resized by accident. Off is the default on load.

### Bitmap content is requested at a size matched to its rendered scale

Overlay content is DOM, so text and vector chrome stay crisp under a CSS transform at any
scale. Bitmaps do not. Avatar URLs already carry a size token, and the existing code rewrites
that token when an avatar is first captured.

Avatar requests inside overlays take a size bucket derived from the overlay's rendered pixel
size multiplied by the device pixel ratio, rounded up to the next bucket. Buckets avoid a fresh
URL, and a fresh fetch, on every pixel of a drag.

*Alternative considered:* always request the largest size. Rejected as wasteful for the common
case of small overlays and a slow first paint on the OBS route.

### The OBS demo checkbox gates the existing sender

Demo values already reach OBS unconditionally whenever the demo stage runs. The checkbox gates
that send. Unchecked, no snapshot is broadcast, the OBS route's staleness timeout drops any
snapshot already held, and OBS returns to real values on its own without a new message type.

While a broadcast is live and the checkbox is on, the control warns plainly that viewers are
seeing invented values. It is not blocked, by decision.

### Goal-reached is demo metrics at or above target

The goal-reached switch sets the demo generator's metrics to their targets rather than
introducing a state flag through the overlay stack. Every consumer that already renders a
reached goal from real metrics renders it from these, on both surfaces, with no new branch.

## Risks / Trade-offs

- [Extracting one renderer regresses what OBS shows, which is the only surface viewers see] →
  Land the extraction with OBS still rendering from real values before any tab work, and keep
  the existing overlay unit tests green across the move. The OBS route's own logic does not
  change; only where the components live.
- [Bumping the layout version resets saved overlay positions] → The version machinery resets
  only box keys listed for that version. List none, so existing positions survive. Load an
  existing saved layout and confirm positions are unchanged before and after.
- [Removing the global Demo switch loses a habit, and the Activity toggle is somewhere new] →
  Accepted; the switch's dual meaning is the thing being removed. The Activity toggle keeps the
  capability rather than dropping it.
- [Demo values on a live broadcast] → Warned rather than blocked, by decision. The warning is
  attached to the control that causes it, not to the page.
- [Avatar size buckets cause a visible swap mid-drag as a bucket boundary is crossed] →
  Bucket upward only during a drag, so an enlarging overlay never re-requests downward, and
  settle to the correct bucket on release.
