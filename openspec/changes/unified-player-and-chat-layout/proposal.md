# Unified player + watch layout (AZ-198, AZ-197)

## Why

There are two video players with zero shared code: `components/video-player/` is a
real custom player for VODs, while `components/live-player.tsx` is a raw
`<video controls>` showing native browser chrome, so the live surface (the phone-first
arrival path from YouTube) has no live-edge control, no quality selector, no
consistent styling, and on iOS hands fullscreen to the OS player. Separately, the
chat panel's height is capped only at the `lg` breakpoint, so below 1024px the chat
has no bounded scroll container and a long chat grows the page instead of scrolling.
Both problems are solved by the same thing — one player that owns a layout mode the
chat column derives its height from — so they land together.

## What Changes

- **One player component** serves both surfaces. `components/live-player.tsx` stops
  being a player; the live page renders the same component the watch page does.
  Liveness is derived from a source descriptor (`mp4` vs `hls` + `live`), never
  passed as a styling flag.
- **Native browser controls are suppressed on the live surface.** The live control
  bar gains a live-edge indicator with a jump-to-live action, and a quality selector
  driven by `hls.levels`.
- **The control bar becomes slot-based** (`transport`, `left`, `right`) so the two
  source types fill the same chrome differently instead of forking the component.
- **BREAKING (internal)**: the per-element `LivePlayer` export is removed. Non-player
  chrome (`mobile-chrome` portrait frame, `DisconnectedOverlay`, viewer-cap states)
  moves into an overlay slot on the shared player.
- **Landscape VODs stop being cropped.** The current `aspect-video` + `object-cover`
  path silently cuts off any landscape video that is not exactly 16:9; the container
  is sized from intrinsic dimensions and letterboxed instead.
- **Layout modes** (`default`, `fullscreen`) are lifted to the page so the chat column
  reacts to them. Theater mode is deliberately out of scope (its own ticket); the
  abstraction admits it later as one more mode.
- **Chat gets a bounded scroll container at every breakpoint.** Desktop chat height
  derives from the shared layout grid rather than the `70vh` constant, so the chat
  column and the player column end level. Mobile uses a `100dvh` grid with the
  composer pinned outside the scroll area.
- **Chat overlays the video in fullscreen** (the Twitch pattern), which makes the
  fullscreen target a stage wrapper containing player and chat, not the player's own
  container.

Out of scope, tracked elsewhere: persistent in-app mini-player and fullscreen
ergonomics (AZ-174), remaining parity gaps such as PiP, resume position, persisted
volume and mobile gestures (AZ-199), captions (AZ-116), chapters (AZ-192), theater
mode (to be filed).

## Capabilities

### New Capabilities

- `unified-video-player`: one player component serving MP4 and HLS sources, its
  slot-based control bar, live-edge and quality affordances, source-derived liveness,
  and the overlay slot for surface-specific chrome.
- `watch-layout`: layout modes shared by the live page and the watch page, the bounded
  chat scroll container at every breakpoint, chat height derivation from the layout
  grid, and the fullscreen chat overlay.

### Modified Capabilities

- `vod-playback`: `Format-aware player container` must forbid cropping (letterbox
  non-16:9 landscape rather than `object-cover`); `Custom player controls` becomes the
  shared control set with a consolidated settings menu.
- `live-playback`: live playback moves to the custom control bar with native controls
  suppressed, and gains live-edge state, jump-to-live, and quality selection.

## Impact

- **Code**: `components/video-player/*` (new `use-media-source.ts`, slot-based
  `controls.tsx`, extended `use-video-state.ts`), `components/live-player.tsx`
  (removed as a player), `components/live-stage.tsx`, `components/live-stream-view.tsx`,
  `components/live-chat.tsx`, `components/chat-replay.tsx`,
  `app/watch/[videoId]/page.tsx`, `lib/use-sticky-scroll.ts`.
- **Dependencies**: `hls.js` moves from the live-only path into the shared player and
  must stay dynamically loaded so the VOD path does not pay for it.
- **No database, action, or API changes.** This is entirely a client-rendering change.
- **Coordination**: `components/live-chat.tsx` is currently modified by the in-flight
  `chat-verify-banner` work; that change should land first. The banner sits above the
  message list and must remain outside the scroll container.
