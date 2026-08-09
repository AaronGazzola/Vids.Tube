# studio Specification

## Purpose
TBD - created by archiving change add-v1-ui-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Owner-only Studio area

The system SHALL provide a Studio area under `/studio`, reachable from an owner-only
entry in the app's primary sidebar, and accessible only to the channel owner. The
Studio SHALL NOT introduce a second sidebar; navigation between Studio tools SHALL be
in-page. The placeholder Upload, Go Live, Broadcasts, Videos and Settings pages
described by earlier versions of this spec were retired when the control room was
folded into `/live`, and SHALL NOT be restored.

#### Scenario: Owner sees the Studio entry

- **WHEN** the channel owner is signed in
- **THEN** the primary sidebar shows a Studio entry alongside the existing entries

#### Scenario: Non-owner does not see the Studio entry

- **WHEN** a signed-in non-owner or an anonymous visitor views the primary sidebar
- **THEN** no Studio entry is shown

#### Scenario: Studio entry is active on a nested route

- **WHEN** the owner is on any route beneath `/studio`
- **THEN** the sidebar's Studio entry renders as the active entry

#### Scenario: Non-owner opens Studio

- **WHEN** a non-owner (anonymous or non-owner user) opens any `/studio` route
- **THEN** they are denied access and redirected away, and the denial is enforced once
  for the whole Studio area rather than separately per tool

### Requirement: Go Live tool

The system SHALL provide a working go-live control surface at `/studio/live` that
reflects the broadcast's current state: stream connection details when idle, a
preview-and-setup experience while in `preview`, and a live-management experience
while `live`.

#### Scenario: Idle — connection details

- **WHEN** the owner opens `/studio/live` and no broadcast is connected
- **THEN** the page shows the RTMP server URL and stream key (with regenerate) so
  the owner can configure their encoder

#### Scenario: Preview — set up and go live

- **WHEN** the owner opens `/studio/live` while a broadcast is in `preview`
- **THEN** the page shows a self-preview player, a setup form for title
  (required), description, and thumbnail, and a Go live control that is disabled
  until a non-empty title is set

#### Scenario: Live — manage the broadcast

- **WHEN** the owner opens `/studio/live` while the broadcast is `live`
- **THEN** the page shows a live indicator and an End control to stop the
  broadcast (live viewer count is tracked separately under analytics, AZ-26)

### Requirement: Broadcasts tool

The system SHALL provide a Broadcasts page at `/studio/broadcasts` where the owner can
view upcoming and past broadcasts and create, edit, or cancel a scheduled broadcast
(see the `scheduled-broadcasts` capability for the authoring behavior).

#### Scenario: Owner opens Broadcasts

- **WHEN** the owner opens `/studio/broadcasts`
- **THEN** the page renders the upcoming and past broadcast lists with controls to
  create, edit, and cancel scheduled broadcasts

#### Scenario: Non-owner opens Broadcasts

- **WHEN** a non-owner opens `/studio/broadcasts`
- **THEN** they are denied access and redirected away

### Requirement: Studio stream list

The system SHALL provide a stream list at `/studio` showing all of the channel's
streams as a **vertical list of rows**, not a grid, newest first. Each row SHALL show
a small thumbnail on the left, then the stream title, then action buttons on the
right. The page SHALL render its shell immediately, with a loading skeleton only in
place of the rows.

#### Scenario: Listing streams

- **WHEN** the owner opens `/studio`
- **THEN** the channel's streams render as one vertical row each, newest first, with a
  small thumbnail, the title, and action buttons

#### Scenario: A stream with no thumbnail

- **WHEN** a stream has no thumbnail
- **THEN** its row renders a placeholder in the thumbnail position and stays aligned
  with the other rows

#### Scenario: Rows are not a grid

- **WHEN** the list is viewed at any viewport width
- **THEN** rows remain one per line, and the thumbnail, title and actions stay in that
  left-to-right order rather than reflowing into cards

#### Scenario: Loading

- **WHEN** the stream list query is pending
- **THEN** the page shell and headings render, with skeleton rows in place of the
  stream rows

### Requirement: Timeline action on a stream row

Each stream row SHALL carry a Timeline action that navigates to that stream's timeline
at `/studio/timeline/[streamId]`. The action SHALL indicate when a stream has no
timeline data yet rather than silently navigating to an empty page.

#### Scenario: Opening a stream's timeline

- **WHEN** the owner activates the Timeline action on a stream row
- **THEN** the app navigates to `/studio/timeline/<that stream's id>`

#### Scenario: A stream with no timeline data

- **WHEN** a stream has no timeline rows
- **THEN** its Timeline action is visibly marked as unlabelled, and following it leads
  to a page that states the stream has not been labelled yet

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

### Requirement: Chapter review

The Timeline page SHALL render the stream's suggested chapters as a separate strip on
the same time axis as the section lanes, so the flat spine can be judged against the
overlapping sections it was derived from. Selecting a chapter SHALL seek the player the
same way selecting a section does.

#### Scenario: Chapters render as a spine

- **WHEN** a stream has chapters
- **THEN** they render as a single non-overlapping strip on the same time axis, each
  showing its title and running to the next chapter's start

#### Scenario: Seeking to a chapter

- **WHEN** the owner selects a chapter
- **THEN** the VOD player seeks to that chapter's start time

#### Scenario: A stream with no chapters

- **WHEN** a labelled stream has no chapter rows
- **THEN** the chapter strip is omitted rather than rendered empty

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

