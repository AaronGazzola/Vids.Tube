## Context

The real Preview tab renders `LivePlayer` (an hls.js `<video>` with `max-h-[80vh]
w-auto`, centered and letterboxed in a black container), so a vertical stream shows at
its native portrait ratio. The demo stage (`DemoPreviewStage`) is a full-bleed
`relative` container whose background (VOD frame slideshow / gradient / black) fills it
with `object-contain`, and whose overlays are absolutely positioned in stage
coordinates. The mobile chrome must anchor to the *video rect* in both contexts, and
two of its elements (top bar, chat input) extend beyond the video's top and bottom
edges.

## Goals / Non-Goals

- Goals: pixel-faithful representation (scale, position, opacity) of the YouTube
  Android live layout from the owner's reference screenshot; one shared persisted
  toggle; zero behavior change when the switch is off.
- Non-goals: interactivity, live data in the chrome, landscape-stream support,
  pop-out support.

## Decisions

### Reference geometry

All chrome dimensions are defined once, in reference pixels against a 1080-wide video
(the screenshot's width), in a single exported constants object in
`components/mobile-chrome.tsx`. At render time every value is multiplied by
`scale = renderedVideoWidthPx / 1080`. Reference values (measured from the screenshot,
fine-tuned visually against it during implementation):

- Top bar: 96 tall, black background, sits fully **above** the video top edge. Left:
  back-arrow glyph, channel avatar (64 circle), then a two-line block — the channel
  handle (34, semibold, white) over a counts row (red live dot, person glyph, viewer
  count, thumb glyph, like count; 28, white/70). Right: white Subscribe pill
  (200 x 62, rounded-full, black 30 text) and a vertical three-dot glyph.
- Chat feed: bottom-left region of the video, left inset 36, width 900. Four sample
  rows plus the notice row, stacked upward from just above the input area, line height
  ~64. Each row: avatar (52 circle), optional member badge chip (crown glyph + rank,
  rounded-full, purple/indigo fill), handle (32, semibold), message text (34, white,
  subtle black text-shadow, wrapping to two lines max). Opacity graduates from 100%
  for the lowest row to ~70% for the highest.
- Notice row: "Welcome to live chat! Remember to guard your privacy and abide by our
  Community Guidelines." with a blue "Learn more" suffix (32, white/90), directly above
  the input row.
- Heart reaction button: 100 circle, red fill, white heart glyph, right inset 36,
  vertically overlapping the boundary between the notice row and the input row.
- Chat input row: 920 x 90 rounded-full dark-gray (#2a2a2a) pill, left inset 36,
  muted "Chat…" placeholder (34) and a smiley glyph at its right end. Positioned
  straddling the video bottom edge: 25% of its height overlaps the video, 75% hangs
  below it.
- Vertical extents beyond the video: 96 above (top bar), 90 below (input protrusion
  plus gap). Exported as `CHROME_ABOVE` / `CHROME_BELOW`.

Sample chat content is a fixed constant list with invented handles/avatars (never real
users); the top bar uses the channel's real handle and avatar (props), with static
representative viewer/like counts.

### Shared component

`components/mobile-chrome.tsx` exports `MobileChromeTopBar`, `MobileChromeOverlay`
(chat feed + notice + heart + input, absolutely positioned against the video rect), the
constants object, and `CHROME_ABOVE`/`CHROME_BELOW`. Both consumers position these
against their own video rect; the components only need `scale` (and the top bar
`handle`/`avatarUrl`).

### Real Preview tab anchoring

`LivePlayer` wraps the `<video>` in a shrink-wrapped `relative` div and gains an
optional `mobileChrome?: { handle: string | null; avatarUrl: string | null } | null`
prop plus an optional `onPortraitChange?: (portrait: boolean | null) => void` callback
(from `loadedmetadata` `videoWidth`/`videoHeight`; `null` until known). When
`mobileChrome` is set and the video is portrait:

- The outer container gains top/bottom padding of `CHROME_ABOVE * scale` /
  `CHROME_BELOW * scale` so the out-of-video elements have room and are not clipped.
- `scale` comes from a `ResizeObserver` on the video element.
- The top bar renders `absolute bottom-full` above the video wrapper; the overlay
  renders `absolute inset-0` within it (the input row positioned at
  `bottom: -(inputHeight * 0.75)`).

The Mobile layout chip on the Preview tab (floating top-right over the player,
`bg-black/70` styling matching the demo control panel) shows whenever the real player
renders. It is disabled with the hint "vertical streams only" while
`portrait === false`, and the chrome only renders when `portrait === true`.

### Demo stage anchoring

The demo stage container stays as-is. When the switch is on:

- The phone anchor is the centered contained rect for a 9:16 frame: a
  `pointer-events-none absolute` box centered horizontally, sized
  `videoW = min(stageW, stageH * 9/16)` (height `videoW * 16/9`), computed from a
  `ResizeObserver` on the stage; `scale = videoW / 1080`.
- To make room above/below the video, the entire existing stream content (background
  layers, overlay boxes, highlight field — everything except the control panel and
  slideshow controls) is wrapped in one div that gets
  `transform: scale(k) translateY(dy)` with `transform-origin: center`, where
  `k = stageH / (stageH + (CHROME_ABOVE + CHROME_BELOW) * scale)` and `dy` shifts the
  scaled content down so the gap above the (scaled) video rect equals
  `CHROME_ABOVE * scale * k` exactly. Scaling the whole wrapper keeps every overlay's
  position relative to the video unchanged, which is the property that makes the
  collision preview truthful.
- The chrome then renders against the scaled video rect (recomputed as
  `videoW * k` wide, centered, offset by `dy`).
- The stage always treats the frame as 9:16 (VOD frames are vertical; gradient/black
  backgrounds have no intrinsic aspect).

### State and persistence

`DemoLayoutConfig` gains a top-level `mobileChrome: boolean` (default `false`,
back-filled by `mergeDemoLayout`). It persists through the existing debounced
`demo_layouts.config` save path and is channel-scoped. `page.tsx` switches its
`useDemoLayout(demo)` call to `useDemoLayout(true)` so the config (and therefore the
shared toggle) is hydrated in both modes; the hook's existing hydrate-once /
save-after-hydrate guards make this safe. Both the Preview-tab chip and the demo
control panel row read `config.mobileChrome` and call the same store setter.

## Risks / Trade-offs

- The demo-stage `transform: scale` slightly shrinks the stream content while the
  switch is on; positions relative to the video are preserved, which is what matters.
- Reference constants are hand-measured from one device's screenshot; other phones
  differ slightly. Accepted — the layout is representative, not device-exact.
