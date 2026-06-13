## ADDED Requirements

### Requirement: Format-aware video card thumbnail

The system SHALL render each video card's poster (and its hover-preview stills)
uncropped regardless of the source video's orientation, while keeping a uniform
card aspect ratio across the listing grid. Orientation SHALL be determined at
runtime from the poster image's intrinsic dimensions (`naturalWidth`/
`naturalHeight`, available on the image's `load` event). Before the poster image
loads, the card SHALL use the stored `videos.width`/`videos.height` as a
first-paint hint, treating the poster as landscape when those are absent.

#### Scenario: Landscape VOD card

- **WHEN** a card's poster is landscape (`naturalWidth >= naturalHeight`, or no
  orientation is yet known)
- **THEN** the poster fills the card's uniform 16:9 container (`object-cover`),
  unchanged from prior behaviour

#### Scenario: Portrait VOD card

- **WHEN** a card's poster is portrait (`naturalHeight > naturalWidth`)
- **THEN** the full poster is shown uncropped, letterboxed (`object-contain`)
  on the card's neutral backdrop inside the same uniform container, so the grid
  keeps uniform card heights

#### Scenario: Stored dimensions missing but poster is portrait

- **WHEN** the VOD's stored `width`/`height` are `null` (e.g. a row recorded
  before dimensions were captured) but the poster image is portrait
- **THEN** the card starts at the landscape fill for first paint and, once the
  poster `load` event reports `naturalHeight > naturalWidth`, corrects to the
  uncropped letterboxed rendering without reloading the image

#### Scenario: Hover-preview stills match the poster orientation

- **WHEN** a portrait VOD card shows its hover-preview slideshow
- **THEN** the preview stills use the same uncropped (`object-contain`) fit as
  the poster, so the slideshow does not crop or jump between cropped and
  letterboxed frames
