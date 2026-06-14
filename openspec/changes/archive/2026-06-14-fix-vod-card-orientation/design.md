## Context

Three surfaces render a thumbnail inside a fixed `aspect-video` (16:9) container
with `object-cover`:

- `components/video-card.tsx` — VOD poster + hover-preview stills.
- `components/scheduled-card.tsx` — channel "coming soon" card (thumbnail behind
  a countdown overlay).
- `app/studio/broadcasts/page.tsx` — the schedule/edit dialog's thumbnail
  preview and each broadcast row's thumbnail.

`object-cover` fills the box and crops overflow, which is correct for landscape
but slices a portrait poster down to a center horizontal strip. Stored
`videos.width`/`height` are `null` on every existing VOD, and `streams` carry no
dimensions at all, so orientation cannot be read from the row.

The watch-page player already solved the equivalent problem
(`components/video-player/VideoPlayer.tsx`): it seeds orientation from stored
`width`/`height` for first paint, then prefers the runtime intrinsic dimensions
read on `loadedmetadata`. These surfaces have no `<video>` element, but each
loads a thumbnail `<img>` whose `naturalWidth`/`naturalHeight` give the same
signal.

## Decisions

### One shared `FittedThumbnail` component, not three copies

The same fit logic is needed on all three surfaces, so it lives in one
presentational component (`components/fitted-thumbnail.tsx`) rather than being
re-implemented per surface. It renders the uniform 16:9 box and the image, owns
the orientation state and `onLoad` detection, and accepts `children` for
per-surface overlays (the card's duration badge and hover-preview layer, the
coming-soon countdown). A shared `isVertical(width, height)` helper (in
`lib/`, `height > width`) keeps parity with the player's rule and is reused for
the first-paint hint.

Props (sketch): `src`, `alt`, optional `width`/`height` hint, `className` for the
container, an optional flag to enable the landscape-only hover zoom, and
`children` rendered above the image.

### Detect orientation from the image, not the DB

Mirror the player's hint-then-runtime approach inside `FittedThumbnail`:
initialise `isPortrait` from the `width`/`height` hint when both are present
(`height > width`), otherwise unknown → treat as landscape for first paint. On
the `<img>`'s `onLoad`, read `naturalHeight > naturalWidth` and update state.
This works for null-dimension VODs and dimensionless scheduled broadcasts, and
corrects after the image loads with no reload.

### Letterbox portrait over a blurred fill, inside the uniform 16:9 box

Keep every card a uniform 16:9 container (portrait-shaped cards would make grid
rows ragged where orientations mix) and switch the image fit by orientation:

- Landscape (or unknown): a single `<img>` with `object-cover` — unchanged.
- Portrait: two stacked copies of the same image inside the box —
  1. a **background** copy with `object-cover` plus `blur` and a slight
     `scale` (so the blur doesn't reveal box edges), filling the side bars;
  2. a **foreground** copy with `object-contain`, showing the full portrait
     uncropped and centered.

This matches YouTube's non-Shorts grid (portrait centered over a blurred fill)
and satisfies both "full portrait without cropping" and "grid stays tidy" with
no `video-grid.tsx` change. The blurred fill is chosen over neutral/`bg-muted`
bars because empty bars look broken next to a content-filled grid.

### No orientation selector — the pixels decide

A manual "vertical/landscape" toggle in the schedule dialog can disagree with the
uploaded image (declare vertical, upload landscape) and would then crop wrong.
Runtime detection from the actual image is never wrong about what was uploaded
and removes a field from the dialog. For a scheduled broadcast the uploaded image
is only a proxy for the eventual stream anyway, so "fit whatever was uploaded" is
the safe behaviour.

### Hover stills inherit the poster's fit; zoom is landscape-only

In the card, the hover-preview stills come from the same source video and share
the poster's orientation, so they use the same `FittedThumbnail` treatment and do
not jump between cropped and letterboxed frames. The `group-hover:scale-105` zoom
applies to landscape only — it would push a letterboxed portrait past its bars.

## Risks / trade-offs

- Portrait thumbnails render a blurred copy of themselves in the side bars. This
  is the accepted, YouTube-consistent look for a uniform grid at MVP scale. A
  dedicated portrait/Shorts shelf or masonry grid is out of scope.
- A portrait thumbnail draws the image twice (blurred background + contained
  foreground). At thumbnail sizes this is negligible; the blurred layer can be
  `aria-hidden` and is skipped entirely for landscape.
- First paint for a dimensionless portrait thumbnail is briefly 16:9
  `object-cover` (cropped) until `onLoad` fires, then corrects — the same
  first-paint behaviour the watch page already ships.
