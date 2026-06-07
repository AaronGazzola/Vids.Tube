## MODIFIED Requirements

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
