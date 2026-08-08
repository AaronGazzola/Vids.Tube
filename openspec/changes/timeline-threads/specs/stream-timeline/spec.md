## REMOVED Requirements

### Requirement: Overlapping timeline sections

**Reason**: A section carries no subject identity, so two spans about the same subject
are unrelated rows and a recurring subject cannot be expressed. Replaced by threads,
which separate subject identity from time and hold one or more spans.

### Requirement: Point moments

**Reason**: A moment with no duration cannot be cut into a clip. Replaced by a moment
that carries a clip window and a peak instant.

## ADDED Requirements

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
