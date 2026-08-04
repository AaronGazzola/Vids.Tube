## MODIFIED Requirements

### Requirement: Format-aware player container

The system SHALL render the watch-page player in a container whose aspect ratio
matches the source video's true orientation. Orientation SHALL be determined at
runtime from the `<video>` element's intrinsic dimensions
(`videoWidth`/`videoHeight`, available on `loadedmetadata`), which reflect the
decoded display orientation including any rotation. Before runtime dimensions are
known, the container SHALL use the stored `videos.width`/`videos.height` as a
first-paint hint, falling back to 16:9 when those are absent.

The full video frame SHALL always be visible: the system SHALL NOT crop the video to
fill its container. A landscape source whose aspect ratio differs from the container's
SHALL be letterboxed or pillarboxed within it, or the container SHALL be sized to the
source's own ratio. Cropping the frame to fill a fixed 16:9 container is prohibited.

#### Scenario: Landscape video

- **WHEN** the playing video's intrinsic `videoWidth >= videoHeight` (or no
  dimensions are yet known)
- **THEN** the player renders inside a 16:9 container at the page's standard
  watch width

#### Scenario: Landscape video that is not 16:9

- **WHEN** the playing video is landscape but its intrinsic aspect ratio is not 16:9,
  such as 4:3 or an ultrawide ratio
- **THEN** the entire frame remains visible, with no edge of the picture cut off

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

The system SHALL render its own controls UI for VOD playback, through the shared player
component and its slot-based control bar, with the following controls available to the
viewer:

- Play / pause toggle
- Seek bar with elapsed, total, and buffered-range indicators
- Current time and total duration text
- Volume slider with mute toggle
- Fullscreen toggle
- Playback-speed selector with the options `0.5x`, `0.75x`, `1x`, `1.25x`,
  `1.5x`, `2x`, presented within the player's consolidated settings menu rather than as
  a standalone menu

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

- **WHEN** a viewer selects a playback speed from the settings menu
- **THEN** the `<video>` element's `playbackRate` updates to that value and
  the selector reflects the new speed

#### Scenario: Viewer enters fullscreen

- **WHEN** a viewer clicks the fullscreen control (or presses `f`)
- **THEN** the watch stage enters fullscreen mode via the standard fullscreen API,
  and exits on the next toggle (or `Escape`)
