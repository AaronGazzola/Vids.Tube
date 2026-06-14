## Why

Vertical (portrait) videos are cropped to a horizontal strip everywhere a
thumbnail is shown in a fixed 16:9 box with `object-cover`: the VOD card grid
(`components/video-card.tsx`), the channel "coming soon" card
(`components/scheduled-card.tsx`), and the studio schedule/preview screen
(`app/studio/broadcasts/page.tsx`). A 1080×1920 poster is center-cropped to a
thin slice instead of showing the video. Orientation cannot come from the
database because `videos.width`/`videos.height` are `null` on existing VODs, and
scheduled broadcasts store no dimensions at all.

The watch-page player already solved the equivalent problem in
`fix-live-vod-experience` by deriving orientation at runtime from the media's
intrinsic dimensions. The thumbnail surfaces were never given the equivalent
treatment, so they still crop.

## What Changes

- **Shared format-aware thumbnail treatment.** Introduce one reusable thumbnail
  renderer that keeps a uniform 16:9 container and chooses the image fit by
  orientation:
  - **Landscape** (or unknown): `object-cover` fill — unchanged behaviour.
  - **Portrait**: the full poster is shown **uncropped** (`object-contain`),
    centered over a **blurred, scaled copy of the same image** that fills the
    side bars (YouTube-style), so the grid keeps uniform card heights and the
    bars are not empty/neutral.
- **Runtime orientation detection.** Orientation is determined at runtime from
  the image's intrinsic dimensions (`naturalWidth`/`naturalHeight` on the
  `load` event), using stored `videos.width`/`videos.height` as a first-paint
  hint when present and treating unknown as landscape until the image loads. No
  orientation selector is added — the actual pixels decide.
- **Applied to every thumbnail surface.** The VOD card poster and its
  hover-preview stills, the channel coming-soon card, and the studio
  schedule/preview dialog preview and broadcast rows all use the shared
  treatment.
- **Hover zoom gated to landscape.** The card's `group-hover:scale-105` zoom
  applies to landscape posters only (it would push a letterboxed portrait past
  its bars).

## Capabilities

### Modified Capabilities

- `vod-playback`: Adds a format-aware video-card thumbnail requirement — card
  posters (and their hover-preview stills) render uncropped regardless of
  orientation, portrait letterboxed over a blurred fill, with runtime
  orientation detection and stored dimensions as a first-paint hint.
- `scheduled-broadcasts`: The channel coming-soon card and the studio Broadcasts
  thumbnails (schedule/edit dialog preview and broadcast rows) render portrait
  thumbnails uncropped using the same blurred-fill letterbox treatment.

## Impact

- **New component:** a shared `FittedThumbnail` (e.g. `components/`) plus a
  shared `isVertical(width, height)` helper (parity with the player's
  `height > width` rule).
- **Components:** `components/video-card.tsx`, `components/scheduled-card.tsx`,
  `app/studio/broadcasts/page.tsx` switch to the shared treatment.
- **Data:** read-only use of existing `videos.width`/`height`/`thumbnail_path`/
  `preview_paths` and `streams.thumbnail_path`; **no schema migration**, no new
  columns.
- **Out of scope:** backfilling `width`/`height` for existing VODs (the runtime
  fallback covers them), capturing dimensions for scheduled broadcasts, the
  empty-`preview_paths` deploy issue (AZ-22), and any dedicated portrait/Shorts
  shelf or masonry grid.
