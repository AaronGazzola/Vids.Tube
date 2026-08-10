## Context

The members strip is a fixed-width, single-line surface on the 1080 by 1920 broadcast
canvas, currently 810 wide. Its sentence is written into the component.

The overlay frame already receives the saved layout two ways: a realtime broadcast fires
within about a second of any edit on the Preview tab, and a fifteen-second poll is the
fallback. The layout is one JSON value, merged on read by a function that already fills in
defaults, migrates older shapes, and protects hand-set positions across version bumps.

The repository has no rich-text editor and deliberately few dependencies. The four marks
wanted here are bold, italic, underline and colour.

## Goals / Non-Goals

**Goals:**

- Several messages in turn, written and reordered by the streamer without a deploy.
- Formatting a streamer can apply by pressing a button, and see before it goes on air.
- One configured message behaves exactly as the strip behaves today.
- Nothing changes for an existing saved layout until the streamer writes a message.

**Non-Goals:**

- A general rich-text editor. Four marks on a one-line strip is the whole surface.
- Formatting anywhere else. Chat, the highlight card and the goals are untouched.
- Per-message timing, scheduling or targeting. Every message dwells the same length.
- Images, links or emoji handling beyond what the font already draws.

## Decisions

### Messages live in the saved layout, not a new table

A message list is stored inside the overlay layout value alongside the boxes, toggles and
opacities.

Chosen over **a dedicated table**, which is the shape the Settings tab already uses for
projects and for chat commands, and which would give ordering and per-row editing for
free. It was rejected because the overlay would then need a second subscription and a
second poll to learn that a message changed, and the two sources could disagree on screen.
Messages ride the layout push that already exists, so a message edit reaches OBS on the
same path and within the same second as dragging a box.

The cost is that reordering is an array operation in a form rather than a row update, which
is a small amount of work in one component.

### Markup is a small dialect, parsed into runs

A message is stored as the text the streamer wrote, including its markup. Rendering parses
it into a list of runs, each carrying its own bold, italic, underline and colour, and draws
each run as an element.

The dialect:

- `**bold**`
- `*italic*`
- `__underline__`
- `{#rrggbb|coloured text}`

Chosen over **storing structured runs** and treating the markup as a display detail. Runs
are the better storage in the abstract, but they require the editor to be the only way to
produce a message, and a one-line strip benefits from being editable as text. Storing the
text keeps the message copy-pasteable and diffable, and the parser is the single place the
dialect is defined.

Chosen over **adding an editor dependency**, which would bring a document model and a
schema for four marks on one line.

Chosen over **Markdown's link syntax for colour**, which reads as a link to anyone who
knows Markdown, on a surface where nothing is clickable.

Parsing never produces markup, and rendering never produces HTML from a string: runs
become elements. There is therefore no injection path, and no sanitiser to get wrong.

Malformed markup renders literally rather than being dropped or throwing. An unclosed
`**` is far more likely to be a streamer mid-edit than an attack, and showing what was
typed is how they see the mistake.

### The editor writes markup, the streamer does not

The Settings tab holds a plain text field per message with a small toolbar: bold, italic,
underline, and a colour swatch. Pressing one wraps the current selection in the
corresponding markup, or inserts an empty pair at the cursor when nothing is selected. The
colour control is a colour input whose value is written into the token.

Beneath each field the message is drawn as the overlay will draw it, on the overlay's own
backing, so what is being judged is what will appear.

### The strip cycles as one row, and the count belongs to the first message

The strip is a fixed-height window with the messages stacked inside it. Advancing moves
the stack downward by exactly one message height, so the message showing leaves at the
bottom and the next arrives from above.

The first message is drawn with the member count beside it, exactly as the strip is drawn
today. Every later message takes the full width. This is the streamer's choice: the count
is a landmark rather than a permanent fixture, and returning to it is part of what makes
the cycle read as a loop.

A single message means no stack, no animation and no timer.

Dwell is a fixed constant rather than a setting. Nothing in the request asked for control
of the timing, and a per-message duration is a setting that has to be explained on a
surface whose whole point is that it is glanceable. The constant is defined in one place so
it can become a setting later without moving anything else.

### An unwritten message list falls back to today's sentence

A layout saved before this change carries no messages. Rather than render an empty strip,
the merge fills in the sentence the strip carries today as the single default message.

This is why the change needs no layout version bump and no migration: the default is
indistinguishable from current behaviour, and the strip only changes once the streamer
writes something.

## Risks / Trade-offs

- **A long message breaks the one-line rule.** The strip never wraps, so an over-long
  message would either overflow or shrink the text below legibility. → The visible length
  of a message is capped, counted after markup is removed so formatting does not eat the
  budget, and the editor shows the count as it is typed.
- **A colour chosen against the strip's dark backing may be unreadable.** → Out of scope to
  police, but the preview draws on the real backing, so an unreadable colour is visible as
  unreadable before it goes on air.
- **Animation on a broadcast overlay costs frames.** The overlay is captured by OBS at the
  broadcast frame rate, and a janky transition is visible to every viewer. → The transition
  moves one element on the compositor rather than animating layout, and the verification
  captures the strip mid-transition rather than only at rest.
- **The message list is stored in the same value as hand-set positions.** A bug in message
  editing could damage a layout that is expensive to redo. → Messages are merged by the
  same function that already protects positions, and its existing tests cover a saved
  layout surviving an unrelated addition.

## Open Questions

None. The cycle behaviour, the count's placement, the markup dialect and the storage
location were each settled before this document was written.
