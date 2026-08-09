## REMOVED Requirements

### Requirement: Overlapping lane rendering

**Reason**: Lanes packed sections to avoid collisions, so a subject's appearances were
scattered across whatever lanes happened to be free. Replaced by thread lanes, where a
lane belongs to a thread and holds every one of its spans.

## MODIFIED Requirements

### Requirement: Studio Timeline page

The system SHALL provide a Timeline page at `/studio/timeline/[streamId]` where the
owner can review that stream's labelled timeline against its VOD. The stream is
identified by the route, not by in-page selection state. The page SHALL render the
full page shell immediately, with loading skeletons only in place of the
data-dependent regions.

#### Scenario: Opening a stream's timeline

- **WHEN** the owner opens `/studio/timeline/<streamId>` for a labelled stream
- **THEN** that stream's threads, spans, moments, chapters and VOD load into the page

#### Scenario: Unknown stream id

- **WHEN** the route names a stream that does not exist or does not belong to the
  channel
- **THEN** the page reports it as not found rather than rendering an empty timeline

#### Scenario: An unlabelled stream

- **WHEN** the owner opens the timeline for a stream that has no timeline rows
- **THEN** the page states that the stream has not been labelled yet, rather than
  rendering an empty timeline as though it had no content

#### Scenario: Returning to the list

- **WHEN** the owner is on a stream's timeline page
- **THEN** a control returns them to the stream list at `/studio`

### Requirement: Sorting and filtering by score

The Timeline page SHALL let the owner rank threads and moments by any one score
criterion and filter them by score, so that a request like "the funniest moments in this
stream" is answerable without scrubbing the VOD. The page SHALL NOT render a control per
tag, because a tag's purpose is finding a subject across streams rather than within one.

#### Scenario: Ranking by a criterion

- **WHEN** the owner sorts by humour
- **THEN** thread lanes are ordered by descending humour, best at the top

#### Scenario: Filtering below a threshold

- **WHEN** the owner filters to entries scoring above a chosen threshold on a criterion
- **THEN** only entries meeting that threshold are shown, and the map states that a
  filter is hiding entries rather than silently omitting them

#### Scenario: Tags are not a per-stream filter

- **WHEN** the owner opens a stream's timeline
- **THEN** no row of per-tag controls is rendered

### Requirement: Click-to-seek

Selecting a moment or a chapter SHALL seek the VOD player to that entry's start time,
so the owner can judge whether the label and scores match what is actually on screen.

#### Scenario: Seeking to an entry

- **WHEN** the owner selects a moment or a chapter
- **THEN** the VOD player seeks to that entry's start time in the video

#### Scenario: Seeking is bounded to the VOD

- **WHEN** an entry's start time lies beyond the VOD's duration
- **THEN** the player seeks no further than the end of the VOD rather than entering an
  invalid state

## ADDED Requirements

### Requirement: The timeline reads as a map of the stream

The Timeline page SHALL render, against one shared axis of real stream time, the
chapters as a ruler, one lane per thread carrying all of that thread's spans, the
moments at the width of their clip windows, and the stretches of the stream that no
thread occupies. Time markings SHALL appear at regular intervals across the axis, not
only at its two ends.

#### Scenario: A recurring subject reads as one lane

- **WHEN** a thread has three spans spread across the stream
- **THEN** all three render on that thread's own lane, so the subject reads as one
  recurring row rather than three unrelated bars

#### Scenario: Concurrent subjects read as a column

- **WHEN** two threads are open at the same instant
- **THEN** they occupy different lanes at that point on the axis, so reading down the
  axis at that instant shows everything that is open

#### Scenario: Moments show their duration

- **WHEN** a moment has a clip window
- **THEN** it renders at the width of that window with its peak marked inside it, and
  not as a point marker

#### Scenario: Unoccupied stretches are visible

- **WHEN** part of the stream belongs to no thread
- **THEN** that stretch is shown as unoccupied on the map

#### Scenario: Labels are drawn, not hidden

- **WHEN** the map renders
- **THEN** each entry's label and its scores are visible without hovering it

#### Scenario: Wide timelines scroll within their container

- **WHEN** a stream's timeline is wider than the viewport
- **THEN** it scrolls horizontally inside its own container and the page body does not
  scroll sideways

### Requirement: A thread plays as one fused sequence

Selecting a thread SHALL play its spans as a single continuous sequence with the gaps
between them removed, and the player's transport SHALL report the fused position and
fused duration so the thread can be scrubbed as one piece. Leaving the fused view SHALL
return to the whole VOD.

#### Scenario: Playing across a gap

- **WHEN** a thread's first span ends and its next span begins later in the stream
- **THEN** playback continues into the next span without the intervening stream time
  being played

#### Scenario: Scrubbing a fused thread

- **WHEN** the owner drags the transport while a thread is playing fused
- **THEN** the transport spans the sum of the thread's spans, and dragging lands at the
  corresponding point within them

#### Scenario: A thread with one span

- **WHEN** a thread has exactly one span
- **THEN** it plays as that span, with the transport bounded to it

#### Scenario: Leaving the fused view

- **WHEN** the owner leaves the fused view
- **THEN** the player returns to the whole VOD at the real time the fused playhead was
  on
