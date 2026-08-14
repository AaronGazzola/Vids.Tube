## Context

The banner renders a message and, on the first message only, the member count with the
Vids.Tube logo. The count comes from its own query; the goal bars get subs, likes and viewers
from the goal progress action, which already carries both the absolute counts and the delta
from a per-stream baseline.

Messages are stored in the layout config as `{ text, align }`. The layout config is one JSON
column, shared with every overlay's position, and is pushed to OBS by realtime.

The editor is a styled-text field with the banner drawn beside it at 0.42 scale.

## Goals / Non-Goals

**Goals:**

- A number on a line is the streamer's choice, per line.
- The thing being typed into is the thing that goes on air.
- Both surfaces resolve the same number from the same place.

**Non-Goals:**

- More than one metric per message. A banner line is one short sentence and one number.
- New overlays, or metrics on any overlay other than the banner.
- Changing the markup dialect.

## Decisions

### Metrics are resolved once, beside the other overlay values

The eight metrics are resolved into a single map alongside the goal metrics and the competition
entries, and handed to the renderer with them. Neither surface computes a number for itself.

Four come from what is already fetched: total subs and current viewers from the goal action's
counts, new subs this stream from its baseline delta, likes this stream from the video. Members
comes from the existing count. Three are new queries — total unique chatters, total chat
commands, new members this stream — added beside the member count action and polled on the same
interval.

*Naming follows the streamer's own list:* a metric saying "this stream" is scoped to the live
broadcast, and one that does not is the channel's lifetime figure.

### An unavailable metric renders as nothing, not as zero

Off air there is no current viewer count and no likes for this stream. Showing zero would be a
claim; showing nothing is the truth. A message whose metric cannot be resolved renders as text
alone, and the composer shows the same, so the streamer sees what a viewer would.

*Consequence:* a line written around its number reads oddly without one. That is visible while
composing, which is where it should be noticed.

### The icon is a name, not a component

The stored metric holds an icon name from a fixed list, and the renderer maps it. Storing
anything richer would put presentation in the layout config and make the set impossible to
change later without another migration.

### The banner becomes the editable surface

The rendering and the field merge: the banner is drawn at its real proportions, scaled to the
column, and its message is contenteditable. The metric and its icon render beside the text as
they will on air, and are not editable inline — they are set from the controls, because a
number pulled live is not something to type over.

Selection offsets are unaffected by the surrounding scale: a CSS transform does not change text
offsets, and the existing field already reads offsets from text nodes rather than from geometry.

*Alternative considered:* keep the field and drop the preview. Rejected: the point of the
request is to see the real thing, and the real thing is 810 wide on a dark backing.

### Migration gives the first message the member count

Removing the fixed count without moving it would take the number off air until the streamer
noticed. The migration adds a members metric with the logo to the first message of every saved
layout, which is exactly what was being rendered before.

## Risks / Trade-offs

- [Three new queries on the overlay poll add database load] → They are counts on indexed
  columns, polled on the existing interval, and only fetched when a message actually asks for
  them.
- [Typing into a scaled surface may feel unusual at small column widths] → The banner keeps its
  real proportions, which is the point; the panel is wide enough at the sizes the tab is used at,
  and the cap still guards overflow.
- [A metric that resolves to nothing leaves a gap mid-sentence] → Deliberate, and visible while
  composing rather than only on air.
- [`react-colorful` is a new dependency] → Small, no transitive dependencies, and it replaces a
  native control that fires continuously while dragging and looks foreign in the panel.
