# Timeline threads: subjects with recurrences, not topic blocks (AZ-206)

## Why

The timeline was built to be the map a shorts workflow reads. It cannot serve that
purpose in its current shape.

Shorts need exactly two operations: **fuse** several spans about one subject into a
sequence, and **trim** a window around one moment. The model supports neither.

A `stream_sections` row is a single contiguous span whose only identity is its text.
Two spans about the same subject are unrelated rows. Measured on the one labelled
broadcast (28-Jul, 1:46:26):

- Account linking appears three times — the banner redesign at 26:41, the first live
  test at 56:19, the final test at 1:35:59 — as three unconnected rows.
- TTS appears at 0:02, at 13:25, and at 1:23:10, likewise unconnected.
- 9 of 17 moments have `end_s = start_s`, so more than half cannot be cut into
  anything: a joke landing at 30:35 has its setup before and its reaction after.
- Sections cover 98% of the stream and two are open at once for only 20% of it, three
  never. The overlap machinery is barely used, so sections and chapters draw nearly the
  same picture — 17 against 16 — which is why the review page reads as redundant.

What the labeller produces is a *segmentation*. What shorts need is an *index of
subjects and where they recur*. Those are different jobs.

The owner has approved replacing the existing model and its content outright. One
broadcast of 168 is labelled, so this is the cheapest moment it will ever be to change.

## What Changes

- **Subject identity separates from time.** A **thread** is a subject: title, summary,
  tags, scores, and no time of its own. A **span** is one appearance of a thread:
  start, end, its own short label and its own scores. A thread has one or more spans.
  Today's section is the degenerate case — a thread with exactly one span.
- **`stream_sections` is replaced** by `stream_threads` + `stream_thread_spans`. The
  old table and its rows are dropped, not migrated.
- **Moments become windows.** A moment carries an in and an out that a clip can be cut
  from, plus the `peak_s` instant the thing actually happens, and may optionally belong
  to a thread. Moments are drawn at their duration on the map, never as pins.
- **Chapters keep their shape and lose their prominence**: still one flat
  non-overlapping derived spine, positioned as the ruler rather than as content.
- **Fused time becomes a first-class primitive.** An ordered set of spans plus the
  mapping between fused time and real time, as pure functions. This is the same edit
  decision list a shorts renderer will consume, so it is built and tested now rather
  than invented twice.
- **The player can follow a fused timeline**: it jumps at each span end and its
  transport reports fused position and fused duration, so a thread is scrubbed as one
  continuous piece with the gaps removed.
- **The studio page is rebuilt on the new model**: threads as lanes in real stream
  time, moments drawn at their windows, chapters as the ruler, uncovered stretches
  visible; labels and scores drawn rather than hidden in hover tooltips; clicking a
  thread plays it fused.
- **Tags become the cross-stream axis.** Threads handle within-stream grouping, so the
  only job left for a tag is finding the same subject across broadcasts. The flat tag
  button row comes off the stream page. The vocabulary is *not* fixed in this change —
  it is read back from evidence after a handful of streams are relabelled.

## What This Change Does Not Do

- **No shorts generation.** The model is shaped so it is ready; nothing renders a clip.
- **No full catalogue run.** Only a handful of streams are relabelled, enough to judge
  the prompt and read the subject vocabulary back. The 168-broadcast run waits until
  the vocabulary is settled so it is paid for once.
- **No live timeline tab.** AZ-206's live path is still unspecced.
- **No controlled tag vocabulary.** Deciding it is the point of the relabel, not an
  input to it.

## Capabilities

### Modified Capabilities

- `stream-timeline`: the section model is replaced by threads and spans; moments gain a
  clip window and a peak; the labelling contract, its validation and its storage change
  to match; fused-time playback over an ordered span set is added.
- `studio`: the timeline review surface is rebuilt on threads, draws moments at their
  duration, and plays a thread as one fused sequence.
- `vod-playback`: the shared player gains the ability to follow a fused timeline.

## Impact

- **Database**: `stream_sections` dropped; `stream_threads` and `stream_thread_spans`
  added; `stream_moments` gains `peak_s` and a nullable `thread_id`. Existing timeline
  rows for the one labelled broadcast are discarded.
- **Code**: the labelling prompt and its payload validation, the backfill writer, the
  lane packer, the studio timeline page and its actions, the shared video player.
- **Cost**: one relabel of roughly six streams, about four minutes each.
- **Risk**: if the model returns threads that all hold exactly one span, the prompt has
  not changed anything and the UI must not be built on top of it. Task 4.3 is the gate.
