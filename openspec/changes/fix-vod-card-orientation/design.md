## Context

`VideoCard` renders the poster and hover-preview stills inside a fixed
`aspect-video` (16:9) container with `object-cover`. `object-cover` fills the box
and crops overflow, which is correct for landscape posters but slices a portrait
poster down to a center horizontal strip. Stored `videos.width`/`height` are
`null` on every existing VOD, so orientation cannot be read from the row.

The watch-page player already solved the equivalent problem
(`components/video-player/VideoPlayer.tsx`): it seeds orientation from stored
`width`/`height` for first paint, then prefers the runtime intrinsic dimensions
read on `loadedmetadata`. The card has no `<video>` element, but it does load a
poster `<img>`, whose `naturalWidth`/`naturalHeight` give the same signal.

## Decisions

### Detect orientation from the poster image, not the DB

Mirror the player's hint-then-runtime approach: initialise `isPortrait` from
stored `video.width`/`video.height` when both are present (`height > width`),
otherwise `null` (unknown → treat as landscape for first paint). On the poster
`<img>`'s `onLoad`, read `naturalHeight > naturalWidth` and update state. This
works for the existing null-dimension VODs and corrects after the poster loads
with no reload. A shared `isVertical(w, h)` helper keeps parity with the player's
rule (`height > width`).

### Letterbox portrait posters inside the uniform 16:9 card (keep the grid tidy)

The acceptance criteria require both "full portrait poster without cropping" and
"the grid stays tidy". A portrait-shaped (9:16) card would show the poster
uncropped but make grid rows ragged where landscape and portrait cards mix.
Instead, keep the existing uniform 16:9 card container for every card and switch
the **image fit**:

- Landscape (or unknown): `object-cover` — unchanged, fills the card.
- Portrait: `object-contain` on the existing `bg-muted` backdrop — the full
  portrait poster is visible, letterboxed with neutral side bars, and every card
  keeps the same height so the grid stays uniform.

This is the smallest change that satisfies both criteria and needs no
`video-grid.tsx` change.

### Hover stills inherit the poster's fit

The preview stills are extracted from the same source video, so they share the
poster's orientation. Apply the same `object-cover`/`object-contain` choice to
the preview `<img>` so a portrait VOD's slideshow is also uncropped and does not
jump between cropped and letterboxed frames on hover.

### Disable the hover zoom for portrait

The landscape hover effect (`group-hover:scale-105`) is fine for a cover-filled
poster but would push a letterboxed portrait past its bars. Keep the zoom for
landscape only.

## Risks / trade-offs

- Letterboxed portrait posters show neutral side bars inside a 16:9 card. This is
  the accepted trade-off for a uniform grid at MVP scale (mostly landscape owner
  streams). If portrait content later dominates, a dedicated portrait card or a
  masonry grid can be revisited — out of scope here.
- First paint for a null-dimension portrait VOD is briefly 16:9 `object-cover`
  (cropped) until the poster `onLoad` fires, then corrects. Same first-paint
  behaviour the watch page already ships.
