## 1. Orientation detection in VideoCard

- [ ] 1.1 Add a shared `isVertical(width, height)` helper (parity with the player's `height > width` rule) or reuse one if already exported
- [ ] 1.2 In `components/video-card.tsx`, initialise an `isPortrait` state from stored `video.width`/`video.height` when both are present, else unknown (treated as landscape for first paint)
- [ ] 1.3 On the poster `<img>` `onLoad`, read `naturalHeight > naturalWidth` and update `isPortrait`, so null-dimension portrait VODs correct after the poster loads with no reload

## 2. Uncropped rendering

- [ ] 2.1 Keep the uniform `aspect-video` card container; apply `object-cover` for landscape/unknown and `object-contain` (on the existing `bg-muted` backdrop) for portrait, to the poster `<img>`
- [ ] 2.2 Apply the same fit to the hover-preview still `<img>` so previews match the poster orientation
- [ ] 2.3 Gate the `group-hover:scale-105` zoom to landscape only (skip it when letterboxing a portrait poster)

## 3. Verify

- [ ] 3.1 Confirm a portrait VOD whose stored `width/height` are `null` shows the full poster uncropped (letterboxed) and its hover slideshow stays uncropped
- [ ] 3.2 Confirm landscape VOD cards are visually unchanged and the grid rows stay uniform with mixed orientations
- [ ] 3.3 Run the project's typecheck/lint (and any `vod-ux-check` script if present); all green
