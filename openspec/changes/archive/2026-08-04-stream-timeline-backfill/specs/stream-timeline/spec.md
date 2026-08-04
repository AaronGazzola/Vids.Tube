## ADDED Requirements

### Requirement: Overlapping timeline sections

The system SHALL store stream sections as rows keyed to a stream, each covering a
span of stream-relative time and describing one thing that is happening. Sections
SHALL be allowed to overlap and nest freely: the system MUST NOT constrain a
stream's sections to a single flat non-overlapping partition. Each section SHALL
carry `stream_id`, `start_s`, `end_s` (nullable), a short `label`, a `summary`, a
`tags` text array, and a `scores` object.

#### Scenario: Two sections cover the same stream time

- **WHEN** a 2400-second "debugging the deploy" section and a 360-second "argument
  about mustaches" section are written for the same stream, the second starting
  inside the first
- **THEN** both rows persist unchanged, with no constraint violation and no
  truncation of either span

#### Scenario: A section is stored with no end

- **WHEN** a section row is written with `end_s` null
- **THEN** the row persists and reads back with `end_s` null, representing a span
  whose end is not yet known

### Requirement: Point moments

The system SHALL store stream moments as rows keyed to a stream, each marking a
point or very short span where something specific happened. A moment SHALL carry
the same `stream_id`, `start_s`, `end_s`, `label`, `summary`, `tags` and `scores`
shape as a section, and SHALL additionally carry a `kind` describing what sort of
moment it is. `end_s` MAY equal `start_s`.

#### Scenario: A zero-length moment

- **WHEN** a moment is written with `start_s` equal to `end_s`
- **THEN** the row persists and reads back as a point on the timeline

#### Scenario: Moment kinds are recorded

- **WHEN** the labelling pass identifies a joke that landed, a chat-rate spike, and
  a chat command being used
- **THEN** three moment rows are written, each with a `kind` distinguishing it from
  the others

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
