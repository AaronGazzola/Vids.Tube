# Design

## The shape of the model

```
stream_threads          one subject in one stream
  id, stream_id, title, summary, tags[], scores jsonb, prompt_version
  (no time of its own)

stream_thread_spans     one appearance of that subject
  id, thread_id, stream_id, start_s, end_s, label, scores jsonb, ordinal

stream_moments          one clippable event
  id, stream_id, thread_id?, start_s, peak_s, end_s, kind, label, summary,
  tags[], scores jsonb

stream_chapters         the ruler (unchanged)
  id, stream_id, start_s, title, status
```

`stream_id` is carried on spans as well as threads. It is redundant against
`thread_id`, and it is there so the map can be read with one query per stream and so
the per-stream delete in the backfill stays a single statement per table.

### Why scores live at both levels

A thread's scores rank it as a shorts candidate. A span's scores decide which parts of
it survive a trim: the mustache thread as a whole may be worth cutting while its middle
appearance is the flattest part of it. Ranking and trimming are different questions and
one number cannot answer both.

Chapters still carry no scores. They are navigation, not candidates.

### Why a span has a label but no summary

The thread's summary says what the subject is. A span's label says which part of it
this is — "first mention", "the denial", "the AI traces them". Repeating a summary per
span would be the model restating itself three times for one subject, which is both
cost and drift.

### Ordinal

Spans carry an explicit `ordinal` rather than relying on `start_s` ordering. Fused
playback is defined as "the thread's spans in order", and while that order is
chronological today, an editor reordering spans is exactly what a shorts workflow does
next. Storing it now costs one integer.

## Fused time

A fused timeline is an ordered list of real-time spans. Two total functions map between
the two clocks:

```
fusedToReal(spans, fusedS) -> { realS, index } | null
realToFused(spans, realS)  -> fusedS | null
```

`fusedToReal` is defined over `[0, fusedDuration]`. `realToFused` returns null for a
real time that falls in a gap, because that instant is genuinely not part of the fused
piece — the caller decides whether to clamp forward to the next span or backward to the
previous one, and the map and the player want different answers.

Boundary rule: a fused time exactly on the seam between span *n* and span *n+1* resolves
to the **start of span n+1**, not the end of span n. Playback crossing a seam must land
in the next piece rather than at the last frame of the one it just left.

Edge cases the tests pin: an empty span list has zero duration and every lookup returns
null; a zero-length span contributes nothing and is skipped rather than trapping the
playhead; overlapping spans in the input are the caller's business, not the mapper's —
it fuses what it is given, in the order given.

### Playback

Following a fused timeline is a watcher on `timeupdate`: when the playhead passes the
end of the current span, seek to the start of the next; at the end of the last span,
pause. Nothing is buffered or re-encoded. The transport reports fused position and
fused duration, so the seek bar is over the fused piece and dragging it maps back
through `fusedToReal`.

This is deliberately the same structure a renderer would consume — an ordered list of
in/out pairs against one source. Building it for review means the shorts work inherits
a tested primitive rather than reinventing it.

## The labelling contract

One `claude -p` call per stream, unchanged. The output shape changes:

```json
{
  "threads":  [ { "title", "summary", "tags": [], "scores": {},
                  "spans": [ { "start_s", "end_s", "label", "scores": {} } ] } ],
  "moments":  [ { "start_s", "peak_s", "end_s", "kind", "label", "summary",
                  "tags": [], "scores": {}, "thread": "<title or null>" } ],
  "chapters": [ { "start_s", "title" } ]
}
```

Spans are nested inside their thread rather than carrying a foreign key, because the
model is being asked to decide relatedness and nesting is how it expresses that
decision without inventing identifiers. A moment references its thread by title, which
is resolved against the threads in the same payload and dropped to null if it does not
match — a dangling reference is not worth failing a four-minute call over.

### What the prompt now insists on

- A subject that comes back later is **one thread with several spans**, not several
  threads. The prompt names the failure mode explicitly, with the account-linking
  example, because that is what the current output gets wrong.
- A moment's `start_s`/`end_s` must be a window that stands alone as a clip — the setup
  before and the reaction after — and `peak_s` is where the thing itself happens.
  `start_s <= peak_s <= end_s`, and a zero-length moment is a validation failure rather
  than something to be silently widened.
- Subjects stay free text. The vocabulary is the output of this exercise, not an input.

### Validation

Payload validation is the gate that keeps a bad four-minute call out of the database,
so it stays strict: every timestamp inside the stream duration, every score an integer
0-100, spans non-empty and ordered within their thread, moment windows non-degenerate.
The one deliberate leniency is the thread reference on a moment.

Boundary snapping against transcript line boundaries still applies, now to spans.

## Prompt version

`PROMPT_VERSION` moves to `timeline-2`. It is written on every row. The backfill's
"already labelled" check becomes version-aware: a stream labelled by an older prompt is
a candidate again, so relabelling the catalogue after a prompt change does not need
`--force` and cannot half-apply.

## The map

Real stream time across the full width. Four bands:

1. **Chapters** — the ruler. Contiguous, labelled, visually quiet.
2. **Threads** — one lane per thread, all of a thread's spans on that lane, so a
   recurring subject reads as a dashed line across the stream rather than as unrelated
   blocks. Lanes are ordered by the thread's score on the selected criterion, so the
   best candidates are at the top.
3. **Moments** — drawn at their window width with the peak marked inside. Never pins.
4. **Coverage** — a thin band showing stretches no thread occupies, because those are
   the parts nothing will ever be made from and they are the fastest read on whether
   the labelling missed something.

Time markings every five minutes, not just the two ends.

Lane assignment changes meaning. The old packer packed *sections* into lanes to avoid
overlap; the new one gives each *thread* a lane and places its spans on it. Two threads
that overlap in time therefore always occupy different lanes, which is the point — the
map answers "what is open right now" by reading a column.

Selecting a thread swaps the player onto that thread's fused timeline; selecting a
moment or a chapter seeks the full VOD. Escaping the fused view returns to the whole
stream at the real time the fused playhead was on.

## What is deliberately not decided here

The subject vocabulary. Six streams are relabelled, the subjects they produce are read
back, and the controlled list is chosen from evidence. Fixing it in advance would be
guessing at a taxonomy with 168 streams of evidence sitting unread.
