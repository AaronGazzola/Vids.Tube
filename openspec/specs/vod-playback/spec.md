# vod-playback Specification

## Purpose
TBD - created by archiving change add-vod-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Public read of ready VODs only

The system SHALL expose only `ready` VODs through the public read path; rows in
`processing` or `failed` state SHALL NOT be readable by clients.

#### Scenario: Ready VOD is publicly readable

- **WHEN** anyone (anonymous or authenticated) queries `videos`
- **THEN** row-level security returns rows whose `status` is `ready` and withholds
  `processing`/`failed` rows

### Requirement: Free VOD playback

The system SHALL play a ready VOD from the configured CDN base URL in a custom
video player without any playback token, credit deduction, or viewer cap, and
SHALL show the VOD's title and (when present) its inherited description below the
player.

#### Scenario: Anonymous viewer watches a VOD

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD
- **THEN** the page plays the MP4 from
  `${NEXT_PUBLIC_VOD_BASE_URL}/<mp4_path>` in the custom seekable player, with
  no sign-in wall and no credit cost, and shows the VOD's title

#### Scenario: VOD with a description

- **WHEN** a viewer opens `/watch/<videoId>` for a `ready` VOD that has a
  `description`
- **THEN** the page shows that description below the title

#### Scenario: Seeking within a VOD

- **WHEN** a viewer seeks to a later position in the VOD
- **THEN** playback resumes from that position via HTTP range requests served
  by the CDN

#### Scenario: Non-ready or missing VOD

- **WHEN** a viewer opens `/watch/<videoId>` for an id that is not a `ready`
  VOD
- **THEN** the page shows a "video not available" state rather than a broken
  player

### Requirement: Channel VOD listing

The channel page SHALL list the channel's `ready` VODs, newest first, each
showing its thumbnail and title and linking to its watch page.

#### Scenario: Channel with published VODs

- **WHEN** a visitor opens a channel page that has `ready` VODs
- **THEN** the page lists those VODs newest-first with thumbnails, replacing the
  empty-state placeholder

#### Scenario: Channel with no VODs

- **WHEN** a visitor opens a channel page that has no `ready` VODs
- **THEN** the page shows the empty "no videos yet" state

### Requirement: Format-aware player container

The system SHALL render the watch-page player in a container whose aspect ratio
matches the source video's true orientation. Orientation SHALL be determined at
runtime from the `<video>` element's intrinsic dimensions
(`videoWidth`/`videoHeight`, available on `loadedmetadata`), which reflect the
decoded display orientation including any rotation. Before runtime dimensions are
known, the container SHALL use the stored `videos.width`/`videos.height` as a
first-paint hint, falling back to 16:9 when those are absent.

#### Scenario: Landscape video

- **WHEN** the playing video's intrinsic `videoWidth >= videoHeight` (or no
  dimensions are yet known)
- **THEN** the player renders inside a 16:9 container at the page's standard
  watch width

#### Scenario: Vertical video

- **WHEN** the playing video's intrinsic `videoHeight > videoWidth`
- **THEN** the player renders inside a 9:16 phone-shaped container, centered on
  the page, bounded so it does not exceed 80% of the viewport height on desktop

#### Scenario: Stored dimensions missing but video is portrait

- **WHEN** the VOD's stored `width`/`height` are `null` (e.g. a row recorded
  before dimensions were captured) but the decoded video is portrait
- **THEN** the container starts at the 16:9 fallback for first paint and, once
  `loadedmetadata` reports `videoHeight > videoWidth`, corrects to the 9:16
  centered container without reloading the video

#### Scenario: First-paint hint from stored dimensions

- **WHEN** the VOD has stored `width`/`height` and the video metadata has not
  yet loaded
- **THEN** the container is sized from the stored dimensions to avoid a layout
  shift, and is reconciled to the intrinsic dimensions once available

### Requirement: Custom player controls

The system SHALL render its own controls UI for VOD playback, with the
following controls available to the viewer:

- Play / pause toggle
- Seek bar with elapsed, total, and buffered-range indicators
- Current time and total duration text
- Volume slider with mute toggle
- Fullscreen toggle
- Playback-speed selector with the options `0.5x`, `0.75x`, `1x`, `1.25x`,
  `1.5x`, `2x`

The native browser controls SHALL be suppressed.

#### Scenario: Viewer plays and pauses

- **WHEN** a viewer clicks the play/pause control (or presses the spacebar)
- **THEN** playback toggles between playing and paused

#### Scenario: Viewer seeks via the seek bar

- **WHEN** a viewer drags the seek bar to a new position
- **THEN** playback jumps to that position and resumes (or stays paused) per
  the previous state

#### Scenario: Buffered range is visible

- **WHEN** the browser has buffered some range ahead of the playhead
- **THEN** the seek bar visually distinguishes the buffered range from the
  unbuffered portion

#### Scenario: Viewer changes playback speed

- **WHEN** a viewer selects a playback speed from the menu
- **THEN** the `<video>` element's `playbackRate` updates to that value and
  the selector reflects the new speed

#### Scenario: Viewer enters fullscreen

- **WHEN** a viewer clicks the fullscreen control (or presses `f`)
- **THEN** the player enters fullscreen mode via the standard fullscreen API,
  and exits on the next toggle (or `Escape`)

### Requirement: Player keyboard shortcuts

The system SHALL respond to the following keyboard shortcuts whenever the
player has focus:

- `Space` — play / pause
- `Left Arrow` / `Right Arrow` — seek back / forward 5 seconds
- `f` — toggle fullscreen
- `m` — toggle mute

#### Scenario: Spacebar toggles playback

- **WHEN** the player has focus and the viewer presses `Space`
- **THEN** playback toggles between playing and paused, and the page does not
  scroll

#### Scenario: Arrow keys seek

- **WHEN** the player has focus and the viewer presses `Right Arrow`
- **THEN** the playhead advances by 5 seconds (clamped to the duration)

### Requirement: Hover preview on video cards

The system SHALL display a cycling slideshow of preview stills when the
pointer hovers over a video card on any video listing.

#### Scenario: Pointer enters a video card

- **WHEN** a pointer device enters a video card whose VOD has at least one
  entry in `preview_paths`
- **THEN** after a brief debounce, the card swaps the poster image for the
  first preview still and advances through the remaining stills at a fixed
  interval, looping

#### Scenario: Pointer leaves a video card

- **WHEN** the pointer leaves the card
- **THEN** the card immediately restores the original poster thumbnail

#### Scenario: VOD has no preview stills

- **WHEN** the VOD's `preview_paths` is empty or null (e.g. an older row that
  predates the pipeline change)
- **THEN** the card shows the static poster on hover with no slideshow

#### Scenario: Touch device

- **WHEN** the card is shown on a device without hover (`(hover: none)`)
- **THEN** the card shows the static poster only and never starts the
  slideshow

