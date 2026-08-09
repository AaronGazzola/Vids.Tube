# stream-timeline Specification

## Purpose
TBD - created by archiving change stream-timeline-backfill. Update Purpose after archive.
## Requirements
### Requirement: Score contract

Every section and moment SHALL carry a `scores` value holding at least the three
criteria `humour`, `interest` and `engagement`. Each score SHALL be an integer from
0 to 100 inclusive, and SHALL be absolute — comparable across different streams,
not normalised within one stream. The column SHALL be a JSON object so that
additional criteria can be recorded later without a schema migration. A row whose
`scores` is missing any of the three required criteria, or holds a value outside
0-100, SHALL be rejected rather than stored.

#### Scenario: A valid score set is stored

- **WHEN** a row is written with `scores` of `{"humour": 82, "interest": 40, "engagement": 67}`
- **THEN** the row persists and each criterion reads back as an integer

#### Scenario: An out-of-range score is rejected

- **WHEN** a row is written with a score of 140 for any criterion
- **THEN** the write is rejected and no row is stored

#### Scenario: A missing required criterion is rejected

- **WHEN** a row is written with `scores` holding only `humour` and `interest`
- **THEN** the write is rejected and no row is stored

#### Scenario: An extra criterion needs no migration

- **WHEN** a row is written with `scores` holding the three required criteria plus a
  fourth criterion
- **THEN** the row persists with all four criteria intact

### Requirement: Timeline read and write access

Timeline rows SHALL be readable by anyone and writable only by the service role,
matching the existing public-read / service-write split used for `featured_messages`.

#### Scenario: Anonymous read

- **WHEN** an anonymous client selects timeline rows for a stream
- **THEN** the rows are returned

#### Scenario: Client write is refused

- **WHEN** a client holding only the publishable key attempts to insert, update or
  delete a timeline row
- **THEN** the write is refused

### Requirement: Per-stream labelling pass

The system SHALL provide a labelling job that, for one stream, reads that stream's
transcript and its chat from both origins, makes exactly **one** `claude -p` call
covering the whole stream, and writes the resulting sections and moments. The pass
SHALL see the whole stream in a single call rather than a sequence of windowed
calls, so that a section spanning most of the stream can be recognised alongside the
shorter sections nested inside it.

#### Scenario: Labelling one stream

- **WHEN** the job runs for a stream that has a transcript
- **THEN** exactly one `claude -p` invocation is made for that stream, and sections
  and moments are written for it

#### Scenario: Chat from both origins is included

- **WHEN** a stream has messages in both `chat_messages` and its VOD's
  `youtube_chat_archive`
- **THEN** the labelling input includes messages from both, each aligned to
  stream-relative time

#### Scenario: A stream with no transcript is skipped

- **WHEN** the job selects a stream that has neither `transcript_segments` nor
  `youtube_transcripts` rows
- **THEN** the stream is skipped with a logged reason, no `claude -p` call is made,
  and the job continues

### Requirement: Transcript source precedence

The labelling pass SHALL use the live `transcript_segments` when both a live-captured
transcript and YouTube captions exist for a stream, and SHALL NOT concatenate the two
sources. It SHALL fall back to `youtube_transcripts` for the stream's VOD only when no
live transcript exists.

#### Scenario: Live transcript wins

- **WHEN** a stream has both `transcript_segments` rows and `youtube_transcripts`
  rows for its VOD
- **THEN** only the `transcript_segments` text is sent to the labelling pass

#### Scenario: Captions used as fallback

- **WHEN** a stream has no `transcript_segments` rows but its VOD has
  `youtube_transcripts` rows
- **THEN** the caption text is sent to the labelling pass

### Requirement: Transcript supplied at source granularity

The labelling pass SHALL supply the transcript to the model as individual timed lines
at the granularity the source stores them, and SHALL NOT merge lines into paragraphs
or drop their timestamps. The accuracy of every emitted boundary is bounded by the
granularity of what the model is shown.

#### Scenario: Segments are not merged

- **WHEN** a stream's transcript is assembled for the labelling pass
- **THEN** each source row appears as its own timed line, retaining its own start time

### Requirement: Section boundary snapping

Section boundaries SHALL be snapped to the nearest transcript boundary within a
tolerance, so a section begins where speech actually begins rather than at a
model-invented timestamp. Moment timestamps SHALL NOT be snapped, because a moment can
legitimately fall part-way through a spoken segment.

#### Scenario: A section start is snapped

- **WHEN** the model emits a section starting at a time that falls within the tolerance
  of a transcript segment boundary
- **THEN** the stored `start_s` is that segment boundary

#### Scenario: A distant boundary is left alone

- **WHEN** the model emits a section boundary with no transcript boundary inside the
  tolerance
- **THEN** the emitted value is stored unchanged rather than being pulled to a distant
  boundary

#### Scenario: Moments are not snapped

- **WHEN** a moment's timestamp falls part-way through a transcript segment
- **THEN** it is stored as emitted

### Requirement: Derived chapters

The labelling pass SHALL additionally produce chapters for the stream: a single flat,
ordered, non-overlapping spine over the VOD, each chapter carrying a `start_s` and a
title and running until the next chapter begins. Chapters SHALL be stored with a
`status` that defaults to `suggested`, so a later change can decide what becomes
public. Chapters SHALL start at the beginning of the VOD, SHALL be strictly
increasing, and SHALL lie within the VOD's duration. A chapter set violating any of
those SHALL be rejected with the rest of the payload rather than stored.

#### Scenario: Chapters are produced alongside sections

- **WHEN** the labelling pass runs for a stream
- **THEN** chapters are written for it in the same pass, in addition to its sections
  and moments

#### Scenario: Chapters form a flat spine

- **WHEN** a stream's chapters are read back
- **THEN** they are strictly increasing in `start_s`, the first begins at the start of
  the VOD, and none overlaps another

#### Scenario: Out-of-order chapters are rejected

- **WHEN** the model emits a chapter whose `start_s` is at or before the previous
  chapter's
- **THEN** the whole payload is rejected and no rows are written for that stream

#### Scenario: Chapters default to suggested

- **WHEN** a chapter row is written by the backfill
- **THEN** its `status` is `suggested`

### Requirement: Idempotent, resumable backfill

The labelling job SHALL be safe to re-run. Re-running it for a stream that already
has timeline rows SHALL leave that stream untouched unless a force flag is given, in
which case the stream's existing rows SHALL be replaced rather than duplicated. The
job SHALL accept a single-stream selector and a batch limit so the operator can
process the back catalogue incrementally, and SHALL log a per-stream summary line
plus a final count of streams labelled, skipped and failed.

#### Scenario: Re-run skips a labelled stream

- **WHEN** the job runs a second time over a stream that already has timeline rows,
  without the force flag
- **THEN** no `claude -p` call is made for that stream, its rows are unchanged, and
  it is reported as skipped

#### Scenario: Force replaces rather than duplicates

- **WHEN** the job runs with the force flag over a stream that already has timeline
  rows
- **THEN** the stream's previous sections, moments and chapters are all removed and
  replaced by the new pass, leaving no duplicates

#### Scenario: Batch limit bounds a run

- **WHEN** the job is run with a limit of 5 against a back catalogue of unlabelled
  streams
- **THEN** at most 5 streams are labelled in that run, and a later run continues with
  the streams that remain

#### Scenario: One stream failing does not abort the batch

- **WHEN** the labelling pass for one stream fails or returns output that does not
  satisfy the score contract
- **THEN** that stream is logged as failed with its reason, no partial rows are left
  behind for it, and the job continues with the remaining streams

### Requirement: Threads carry subject identity

The system SHALL model a stream's subjects as threads, where a thread has a title, a
summary, tags and scores but no time of its own, and SHALL record each appearance of
that subject as a span belonging to it. A subject that occurs in more than one place in
a stream SHALL be one thread with several spans, not several threads.

#### Scenario: A subject that recurs

- **WHEN** a stream discusses account linking at 26:41, again at 56:19, and again at
  1:35:59
- **THEN** one thread exists for account linking, holding three spans

#### Scenario: A subject that occurs once

- **WHEN** a stream discusses a subject in exactly one continuous stretch
- **THEN** one thread exists for it, holding one span

#### Scenario: Threads overlap freely

- **WHEN** two threads are both open at the same instant
- **THEN** both are recorded, and neither is truncated to avoid the overlap

### Requirement: Spans locate a thread in time

Every span SHALL carry a start, an end, a short label naming which part of the thread it
is, an ordinal fixing its position in the thread's sequence, and its own scores. A
thread SHALL have at least one span.

#### Scenario: Spans are ordered within their thread

- **WHEN** a thread's spans are read
- **THEN** they are returned in ordinal order

#### Scenario: A span scores separately from its thread

- **WHEN** a thread is a strong candidate but one of its appearances is weak
- **THEN** the thread's scores and that span's scores differ, and both are stored

### Requirement: Moments are clippable windows

Every moment SHALL carry a start, an end and a peak instant, where the start and end
bound a window that stands alone as a clip and the peak marks where the event happens.
The system SHALL reject a moment whose window has no duration, and SHALL require
`start_s <= peak_s <= end_s`.

#### Scenario: A joke keeps its setup and reaction

- **WHEN** a joke lands at 30:35
- **THEN** the moment's window begins before the setup and ends after the reaction, and
  its peak is 30:35

#### Scenario: A zero-length moment is refused

- **WHEN** a labelling pass returns a moment whose end equals its start
- **THEN** the payload is rejected and nothing is written for that stream

### Requirement: A moment may belong to a thread

A moment SHALL be allowed to reference the thread it belongs to, and SHALL be allowed to
reference none. A reference that does not resolve to a thread in the same payload SHALL
be dropped to none rather than failing the payload.

#### Scenario: A moment inside a subject

- **WHEN** the AI traces the mustache commenter during the mustache thread
- **THEN** that moment references the mustache thread

#### Scenario: A moment belonging to nothing

- **WHEN** a chat spike is recorded that belongs to no particular subject
- **THEN** the moment references no thread

#### Scenario: An unresolvable reference

- **WHEN** a moment references a thread title that is not in the payload
- **THEN** the moment is stored with no thread and the rest of the payload is written

### Requirement: Fused time over an ordered span set

The system SHALL provide total mappings between fused time and real time for an ordered
set of spans, where fused duration is the sum of the spans' durations and gaps between
spans are absent from fused time.

#### Scenario: Fused position maps to real position

- **WHEN** spans are 100-200 and 500-600 and fused time 120 is requested
- **THEN** real time 520 is returned, twenty seconds into the second span

#### Scenario: A real time inside a gap

- **WHEN** the same spans are used and real time 300 is requested
- **THEN** no fused time is returned, because that instant is not part of the fused piece

#### Scenario: A seam resolves forward

- **WHEN** the same spans are used and fused time 100 is requested
- **THEN** real time 500 is returned, the start of the second span, not the end of the first

#### Scenario: An empty set

- **WHEN** the span set is empty
- **THEN** the fused duration is zero and every lookup returns nothing

### Requirement: Labelling emits threads, moment windows and chapters

The labelling pass SHALL return threads with their spans nested inside them, moments
with a window and a peak, and chapters, in a single call per stream. It SHALL be told
that a subject occurring in several places is one thread with several spans.

#### Scenario: The payload shape

- **WHEN** a labelling pass completes
- **THEN** the payload holds exactly `threads`, `moments` and `chapters`, and each
  thread holds its own spans

#### Scenario: Timestamps stay inside the stream

- **WHEN** any span, moment or chapter carries a timestamp past the stream's duration
- **THEN** the payload is rejected and nothing is written for that stream

### Requirement: Labelling is versioned and re-runnable

Every stored row SHALL record the prompt version that produced it, and a stream labelled
by an older prompt version SHALL be treated as a candidate for relabelling without
needing an override flag.

#### Scenario: A stream labelled by an older prompt

- **WHEN** the prompt version changes and the backfill runs
- **THEN** streams carrying the older version are selected for relabelling

#### Scenario: A stream labelled by the current prompt

- **WHEN** the backfill runs again with no version change and no override
- **THEN** streams already carrying the current version are skipped

#### Scenario: Relabelling replaces rather than accumulates

- **WHEN** a stream that already has timeline rows is relabelled
- **THEN** its previous threads, spans, moments and chapters are removed and only the
  new ones remain

