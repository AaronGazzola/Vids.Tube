## 1. Shared helper and component

- [x] 1.1 Add a shared `isVertical(width, height)` helper in `lib/` (parity with the player's `height > width` rule; returns `false` when either dimension is missing) — reuse if one is already exported
- [x] 1.2 Create `components/fitted-thumbnail.tsx`: a presentational component that renders a uniform `aspect-video` 16:9 container and the thumbnail image, owns `isPortrait` state, and renders `children` (overlays) above the image
- [x] 1.3 Seed `isPortrait` from optional `width`/`height` hint props (`isVertical(...)`) for first paint; default unknown → landscape
- [x] 1.4 On the image's `onLoad`, set `isPortrait` from `naturalHeight > naturalWidth` so dimensionless thumbnails correct after load with no reload
- [x] 1.5 Render landscape/unknown as a single `<img object-cover>`; render portrait as a blurred `object-cover` background copy (with slight scale, `aria-hidden`) plus a foreground `object-contain` copy of the same `src`
- [x] 1.6 Expose an optional `zoomOnHover` prop that applies the `group-hover:scale-105` effect to the foreground image only when landscape

## 2. VOD card (`components/video-card.tsx`)

- [x] 2.1 Replace the poster `<img>` block with `FittedThumbnail`, passing `video.width`/`video.height` as the hint and `zoomOnHover` enabled
- [x] 2.2 Render the hover-preview still through the same fit (its own `FittedThumbnail` or shared fit logic) so previews match the poster orientation
- [x] 2.3 Keep the duration badge as a child overlay; confirm the `group-hover:scale-105` zoom is gated to landscape via `zoomOnHover`

## 3. Scheduled-broadcast surfaces

- [x] 3.1 In `components/scheduled-card.tsx`, render the coming-soon thumbnail through `FittedThumbnail`, keeping the countdown block as a child overlay
- [x] 3.2 In `app/studio/broadcasts/page.tsx`, render the schedule/edit dialog thumbnail preview through `FittedThumbnail` (replacing the `aspect-video object-cover` `<img>`)
- [x] 3.3 In `app/studio/broadcasts/page.tsx`, render each broadcast row's thumbnail through `FittedThumbnail`, keeping the `CalendarClock` placeholder when there is no thumbnail
- [x] 3.4 Confirm no orientation/aspect selector was added to the schedule/edit dialog

## 4. Verify

- [x] 4.1 Confirm a portrait VOD whose stored `width/height` are `null` shows the full poster uncropped over a blurred fill, and its hover slideshow stays uncropped
- [x] 4.2 Confirm a portrait broadcast thumbnail renders uncropped over a blurred fill in the coming-soon card, the studio rows, and the dialog preview
- [x] 4.3 Confirm landscape VOD/broadcast thumbnails are visually unchanged and grids/rows stay uniform with mixed orientations
- [x] 4.4 Run the project's typecheck/lint (and any `vod-ux-check` script if present); all green
