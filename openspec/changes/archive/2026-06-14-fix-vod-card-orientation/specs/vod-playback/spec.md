## ADDED Requirements

### Requirement: Format-aware video card thumbnail

The system SHALL render each video card's poster (and its hover-preview stills)
uncropped regardless of the source video's orientation, while keeping a uniform
card aspect ratio across the listing grid. Orientation SHALL be determined at
runtime from the poster image's intrinsic dimensions (`naturalWidth`/
`naturalHeight`, available on the image's `load` event). Before the poster image
loads, the card SHALL use the stored `videos.width`/`videos.height` as a
first-paint hint, treating the poster as landscape when those are absent. A
portrait poster SHALL be shown uncropped (`object-contain`) centered over a
blurred, scaled copy of the same image that fills the side bars, inside the
uniform 16:9 container.

#### Scenario: Landscape VOD card

- **WHEN** a card's poster is landscape (`naturalWidth >= naturalHeight`, or no
  orientation is yet known)
- **THEN** the poster fills the card's uniform 16:9 container (`object-cover`),
  unchanged from prior behaviour

#### Scenario: Portrait VOD card

- **WHEN** a card's poster is portrait (`naturalHeight > naturalWidth`)
- **THEN** the full poster is shown uncropped (`object-contain`), centered over a
  blurred, scaled copy of the same poster that fills the side bars, inside the
  same uniform 16:9 container, so the grid keeps uniform card heights

#### Scenario: Stored dimensions missing but poster is portrait

- **WHEN** the VOD's stored `width`/`height` are `null` (e.g. a row recorded
  before dimensions were captured) but the poster image is portrait
- **THEN** the card starts at the landscape fill for first paint and, once the
  poster `load` event reports `naturalHeight > naturalWidth`, corrects to the
  uncropped blurred-fill rendering without reloading the image

#### Scenario: Hover-preview stills match the poster orientation

- **WHEN** a portrait VOD card shows its hover-preview slideshow
- **THEN** the preview stills use the same uncropped blurred-fill fit as the
  poster, so the slideshow does not crop or jump between cropped and letterboxed
  frames

#### Scenario: Hover zoom only on landscape

- **WHEN** the pointer hovers a card
- **THEN** the `scale` zoom effect is applied only when the poster is landscape,
  and is suppressed for a letterboxed portrait poster so it is not pushed past
  its bars
