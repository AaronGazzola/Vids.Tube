## MODIFIED Requirements

### Requirement: Free VOD playback

The system SHALL play a ready VOD from the configured CDN base URL in a custom
video player without any playback token, credit deduction, or viewer cap.

#### Scenario: Anonymous viewer watches a VOD

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD
- **THEN** the page plays the MP4 from
  `${NEXT_PUBLIC_VOD_BASE_URL}/<mp4_path>` in the custom seekable player, with
  no sign-in wall and no credit cost

#### Scenario: Seeking within a VOD

- **WHEN** a viewer seeks to a later position in the VOD
- **THEN** playback resumes from that position via HTTP range requests served
  by the CDN

#### Scenario: Non-ready or missing VOD

- **WHEN** a viewer opens `/watch/<videoId>` for an id that is not a `ready`
  VOD
- **THEN** the page shows a "video not available" state rather than a broken
  player

## ADDED Requirements

### Requirement: Format-aware player container

The system SHALL render the watch-page player in a container whose aspect
ratio matches the source video's orientation, derived from `videos.width` and
`videos.height`.

#### Scenario: Landscape video

- **WHEN** the VOD's `width >= height` (or dimensions are missing)
- **THEN** the player renders inside a 16:9 container at the page's standard
  watch width

#### Scenario: Vertical video

- **WHEN** the VOD's `height > width`
- **THEN** the player renders inside a 9:16 phone-shaped container, centered
  on the page, bounded so it does not exceed 80% of the viewport height on
  desktop

#### Scenario: Dimensions missing

- **WHEN** the VOD has `null` `width` or `height` (e.g. an older row that
  predates the pipeline change)
- **THEN** the player falls back to the 16:9 container without erroring

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
