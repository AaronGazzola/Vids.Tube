## ADDED Requirements

### Requirement: Format-aware scheduled-broadcast thumbnails

The system SHALL render a scheduled broadcast's thumbnail uncropped regardless of
its orientation, using the same fixed 16:9 container as before. Where a broadcast
thumbnail is shown — the channel coming-soon card (`components/scheduled-card.tsx`),
the studio Broadcasts rows and the schedule/edit dialog preview
(`app/studio/broadcasts/page.tsx`) — a portrait thumbnail SHALL be shown
uncropped (`object-contain`) centered over a blurred, scaled copy of the same
image that fills the side bars, and a landscape thumbnail SHALL fill the
container (`object-cover`) as before. Orientation SHALL be determined at runtime
from the thumbnail image's intrinsic dimensions (`naturalWidth`/`naturalHeight`
on the image's `load` event); broadcasts carry no stored dimensions, so the
thumbnail SHALL be treated as landscape until it loads. No orientation selector
SHALL be added to the schedule/edit dialog.

#### Scenario: Portrait coming-soon card

- **WHEN** the channel coming-soon card shows a portrait thumbnail
  (`naturalHeight > naturalWidth`)
- **THEN** the full thumbnail is shown uncropped, centered over a blurred fill of
  the same image inside the 16:9 card, with the countdown overlay unchanged on top

#### Scenario: Portrait thumbnail in the studio Broadcasts list

- **WHEN** the owner views the Broadcasts page and a row's thumbnail is portrait
- **THEN** the row thumbnail shows the full image uncropped over a blurred fill,
  in the same fixed thumbnail box, so rows stay uniform

#### Scenario: Portrait thumbnail preview in the schedule/edit dialog

- **WHEN** the owner has set (or is editing) a portrait thumbnail in the
  schedule/edit dialog
- **THEN** the dialog preview shows the full portrait thumbnail uncropped over a
  blurred fill rather than a center-cropped strip, and the dialog offers no
  vertical/landscape selector

#### Scenario: Landscape thumbnails unchanged

- **WHEN** a broadcast thumbnail is landscape (or not yet loaded)
- **THEN** it fills its 16:9 container (`object-cover`) exactly as before
