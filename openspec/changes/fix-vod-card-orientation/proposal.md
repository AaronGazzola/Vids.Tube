## Why

Vertical VODs are cropped to a horizontal strip on every video listing.
`VideoCard` (`components/video-card.tsx`) wraps the poster in a fixed
`aspect-video` (16:9) box with `object-cover`, so a portrait poster (e.g.
1080×1920) is center-cropped and the viewer sees a thin horizontal slice instead
of the video. Orientation cannot come from the database because `videos.width`/
`videos.height` are `null` on existing VODs (the same legacy-pipeline gap that
the watch-page player already works around at runtime).

The watch page was fixed for this in `fix-live-vod-experience` by deriving
orientation at runtime from the `<video>` element's intrinsic dimensions. The
card grid was never given the equivalent treatment, so the listing still crops.

## What Changes

- **Format-aware card thumbnail.** `VideoCard` determines the poster's
  orientation at runtime from the poster `<img>`'s `naturalWidth`/
  `naturalHeight` (on `load`), using stored `videos.width`/`videos.height` as a
  first-paint hint when present. A portrait poster is shown **uncropped**
  (letterboxed with `object-contain`) inside the card's uniform 16:9 container,
  so the full portrait is visible and the grid keeps uniform card heights.
  Landscape posters are unchanged (`object-cover` fill).
- **Hover stills match the poster.** The hover-preview slideshow stills use the
  same fit as the poster, so a portrait VOD's previews are also shown uncropped.

## Capabilities

### Modified Capabilities

- `vod-playback`: Adds a format-aware video-card thumbnail requirement — card
  posters (and their hover-preview stills) render uncropped regardless of
  orientation, with runtime orientation detection from the poster image and
  stored dimensions as a first-paint hint.

## Impact

- **Components:** `components/video-card.tsx` (orientation state + container/
  image-fit logic). `components/video-grid.tsx` only if grid sizing needs to
  accommodate the change (the chosen letterbox approach keeps the existing
  uniform 16:9 cards, so no grid change is expected).
- **Data:** read-only use of existing `videos.width`/`videos.height`/
  `thumbnail_path`/`preview_paths`; **no schema migration**, no new columns.
- **Out of scope:** backfilling `width`/`height` for existing VODs (the runtime
  fallback covers them) and the empty-`preview_paths` deploy issue (tracked
  separately as the AZ-22 VM redeploy).
