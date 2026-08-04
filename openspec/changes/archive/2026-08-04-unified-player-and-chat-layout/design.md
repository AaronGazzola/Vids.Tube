## Context

Two players exist with no shared code:

- `components/video-player/` — `VideoPlayer.tsx`, `controls.tsx`, `seek-bar.tsx`
  (buffered range), `volume-control.tsx`, `speed-menu.tsx`, `use-video-state.ts`.
  MP4 via the `src` attribute, autohiding controls, keyboard shortcuts.
- `components/live-player.tsx` — hls.js attachment plus `<video controls>`. Native
  browser chrome, one custom affordance ("Tap to unmute"), portrait detection feeding
  the `mobile-chrome.tsx` frame.

`use-video-state.ts` already reads only `HTMLMediaElement` events, so it works against
an HLS-fed element today with no changes. That is the reason unification is cheap: the
state layer is already source-agnostic, and only source attachment and two control-bar
regions actually differ.

The chat panels (`live-chat.tsx`, `chat-replay.tsx`) are correct in isolation — inner
`overflow-y-auto` list, `useStickyScroll` for auto-follow and the "New messages" pill.
The defect is ancestor height: the only cap is `lg:h-[70vh]` in
`live-stream-view.tsx` (lines 69, 96) and `app/watch/[videoId]/page.tsx` (line 99).
Below `lg` the wrapper is `height: auto`, `h-full` resolves to auto, nothing overflows,
and `scrollTo` on a container where `scrollHeight === clientHeight` is a no-op.

Constraint discovered while scoping: because chat must overlay the video in fullscreen,
the fullscreen element cannot be the player's own container. It must be a wrapper that
contains both.

## Goals / Non-Goals

**Goals:**

- One player component for both sources, so the two surfaces cannot drift apart again.
- Live viewers get live-edge state, jump-to-live, and quality selection.
- Chat scrolls inside a bounded container at every breakpoint, on both pages.
- Chat height derives from the shared layout rather than a magic viewport constant.
- Layout mode is a first-class concept that theater mode and AZ-174's mini-player can
  extend without another refactor.

**Non-Goals:**

- Theater mode (deferred to its own ticket; the mode union admits it later).
- Persistent in-app mini-player and fullscreen ergonomics beyond the chat overlay
  (AZ-174).
- PiP, resume position, persisted volume, mobile gestures, scrub preview (AZ-199).
- Captions (AZ-116), chapters (AZ-192).
- Live DVR seeking. `backBufferLength: 30` gives about 30 seconds of back buffer, which
  is not a usable DVR window, so the live transport is a live-edge indicator and not a
  seek bar.

## Decisions

### Source descriptor over a boolean flag

The player takes a discriminated union rather than `isLive`:

```
type PlayerSource =
  | { kind: "mp4"; src: string; poster?: string }
  | { kind: "hls"; src: string; live: boolean }
```

Liveness and transport shape derive from `kind`/`live`. Alternative considered: an
`isLive` prop alongside `src`. Rejected because it permits nonsense states (`isLive`
with an MP4) and because the descriptor is what the engine layer needs anyway.

### Engine extracted to `use-media-source.ts`

A hook owning attachment and teardown: sets `video.src` for `mp4`; for `hls` it
dynamically imports hls.js, calls `loadSource`/`attachMedia`, and keeps the existing
error-recovery ladder (network → `startLoad`, media → `recoverMediaError`, else
`destroy`). Returns `{ levels, activeLevel, setLevel, latency, liveSyncPosition }`,
empty/undefined for MP4.

Dynamic import matters: hls.js is currently imported statically by the live player
only. Moving it into the shared player would put it in the watch page bundle for no
benefit, so the import happens inside the `hls` branch.

Alternative considered: keep two components and share only the controls. Rejected —
that is the current structure minus one file, and it is what allowed the drift.

### Slot-based control bar

`controls.tsx` becomes a shell with three slots:

- `transport` — seek bar + time (MP4) or live badge (live HLS)
- `left` — play/pause, volume
- `right` — settings, fullscreen

This is the Media Chrome / Vidstack composition pattern. Alternative considered:
conditionals inside one control bar. Rejected because every future per-source control
adds another branch to a component that should not know about source types.

### Live-edge state derived, not tracked

`atLiveEdge` is computed as `liveSyncPosition - currentTime <= LIVE_EDGE_TOLERANCE_S`
rather than stored, so it cannot go stale against the media element. The badge renders
active at the edge and inactive when behind; clicking when behind seeks to
`liveSyncPosition`.

### The stage wrapper is the fullscreen element

A `WatchStage` wrapper contains the player and a chat slot and holds the ref that
`requestFullscreen` targets. The player's fullscreen button calls into layout context
rather than its own container.

Consequence, accepted deliberately: chat must be a descendant of the stage wrapper on
both pages, which constrains page structure. Alternative considered: portal the chat
into the player container on fullscreen entry. Rejected — remounting chat mid-stream
would drop scroll position and re-run the realtime subscription.

### Layout mode lives in React context, not a store

`WatchLayoutContext` provides `{ mode, setMode, stageRef }` with
`mode: "default" | "fullscreen"`. It is per-page ephemeral UI state with no
cross-route persistence, so context is the right tool and a Zustand store would be
overreach. When AZ-174 adds a persistent mini-player that survives navigation, that
one mode graduates to `app/layout.stores.ts`.

### Chat height from the grid, not from a viewport constant

Desktop: the two-column grid gets an explicit row, and both the player column and the
chat column are `min-h-0` grid children, so the chat's `h-full` resolves against the
row rather than against `auto`. The columns end level because they share the row.

Mobile: the stage is a `100dvh` grid — player row `auto`, chat row `1fr` — with the
chat panel `min-h-0` and the composer a non-scrolling flex row outside the message
list. `dvh` rather than `vh` so mobile browser chrome collapsing does not clip the
composer.

The `min-h-80` currently on both chat panels is removed; it fights a bounded container
by forcing a floor taller than the available row on small screens.

### Fullscreen chat overlay defaults differ by surface

In fullscreen the chat renders as a translucent overlay pinned to one side, with a
visibility toggle in the control bar. Default visible on the live page, default hidden
on the watch page — a live chat is part of the live experience, whereas a replay
overlaying its own video is noise. The toggle is per-session state, not persisted.

## Risks / Trade-offs

- **Regression surface on the VOD player is wide.** The extraction touches every
  existing control. → Sequence the work so the VOD player is refactored and verified
  behaviourally unchanged before any live code is pointed at it; the crop fix is the
  only intentional VOD behaviour change in this phase.

- **`aspect-video` is currently load-bearing for first paint.** The existing spec uses
  stored `videos.width`/`height` as a first-paint hint to avoid layout shift. Sizing
  from intrinsic dimensions could reintroduce shift. → Keep the stored-dimensions hint
  for first paint and reconcile on `loadedmetadata`; only the cropping changes, not the
  hint.

- **Chat inside the fullscreen element constrains page structure.** Both pages must
  render chat within the stage wrapper. → Accepted; documented in the specs so a later
  page refactor does not silently break fullscreen chat.

- **hls.js in the shared player risks bundling into the watch page.** → Dynamic import
  inside the `hls` branch; verify the watch-page bundle does not include it.

- **Conflict with in-flight `chat-verify-banner`.** Both touch `live-chat.tsx`. → Land
  the banner first. The banner must sit outside the scroll container, between the
  header and the message list, so it is never scrolled away.

- **`100dvh` support.** Older mobile Safari lacks `dvh`. → `vh` fallback via a preceding
  declaration; the failure mode is the current behaviour, not a worse one.
