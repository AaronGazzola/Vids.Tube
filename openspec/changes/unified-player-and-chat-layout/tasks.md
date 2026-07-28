## 1. Engine and state layers (VOD behaviour unchanged)

- [ ] 1.1 Add `components/video-player/types.ts` exporting the `PlayerSource`
  discriminated union (`{ kind: "mp4"; src: string; poster?: string }` and
  `{ kind: "hls"; src: string; live: boolean }`) plus a `MediaSourceState` type for the
  engine's return value.
- [ ] 1.2 Create `components/video-player/use-media-source.ts`: a hook taking
  `(videoRef, source)` that attaches `video.src` for `mp4`; for `hls` prefers native
  playback when `canPlayType("application/vnd.apple.mpegurl")` is truthy, otherwise
  `await import("hls.js")` inside the effect, instantiates with the current live config
  (`lowLatencyMode`, `liveDurationInfinity`, `backBufferLength: 30`,
  `maxLiveSyncPlaybackRate: 1.5`), and ports the existing error ladder from
  `live-player.tsx` verbatim (network → `startLoad`, media → `recoverMediaError`, else
  `destroy`). Return `{ levels, activeLevel, setLevel, latency, liveSyncPosition }`,
  with empty/undefined values for `mp4`. Destroy the instance and remove listeners on
  source change and unmount.
- [ ] 1.3 Remove the static `import Hls from "hls.js"` path from the codebase so hls.js
  is only reachable through the dynamic import in `use-media-source.ts`.
- [ ] 1.4 Extend `components/video-player/use-video-state.ts` with `buffering` (true
  between `waiting`/`stalled` and the next `playing`/`canplay`), `error` (set from the
  media element's `error` event), and `seekable` (false for a live source, true for
  `mp4`); add the corresponding listeners to the existing event list.
- [ ] 1.5 Add `atLiveEdge` and `secondsBehindLive` to the state hook, derived each sync
  from `liveSyncPosition - currentTime` against a `LIVE_EDGE_TOLERANCE_S` constant, not
  stored as independent state. Both are undefined for `mp4` sources.

## 2. Slot-based control bar (still VOD only)

- [ ] 2.1 Refactor `components/video-player/controls.tsx` to accept `transport`, `left`
  and `right` slot nodes and render the gradient/autohide shell around them, keeping
  the current visual treatment.
- [ ] 2.2 Create `components/video-player/transport-vod.tsx` wrapping the existing
  `SeekBar` plus the elapsed/duration text and its `formatTime` helper.
- [ ] 2.3 Create `components/video-player/settings-menu.tsx`: one gear menu that renders
  a speed section for `mp4` sources and a quality section for live `hls` sources.
  Replace the standalone `SpeedMenu` usage in the control bar with it, preserving the
  `0.5x`–`2x` options.
- [ ] 2.4 Rewire `VideoPlayer.tsx` to consume `use-media-source` and the slot-based
  control bar for the `mp4` path only, and confirm the watch page behaves exactly as
  before (play/pause, seek, buffered range, volume, mute, speed, fullscreen, keyboard).
- [ ] 2.5 Add `buffering` and `error` presentation to the player: a spinner while
  buffering and an error state replacing the video when the source fails.

## 3. Fix the crop path in shared sizing

- [ ] 3.1 In `VideoPlayer.tsx`, replace the forced `aspect-video` + `object-cover`
  landscape branch with sizing from the intrinsic ratio and `object-contain`, keeping
  the stored `videos.width`/`height` first-paint hint and the `loadedmetadata`
  reconciliation, and keeping the portrait 9:16 centered container bounded to 80vh.
- [ ] 3.2 Verify with a non-16:9 landscape VOD (4:3 or ultrawide) that the full frame is
  visible with no cropped edges, that a 16:9 VOD is visually unchanged, and that
  portrait rendering is unchanged.

## 4. Watch layout context and stage

- [ ] 4.1 Create `components/watch-layout.tsx` exporting `WatchLayoutProvider`,
  `useWatchLayout` and a `WatchStage` wrapper. Context value:
  `{ mode: "default" | "fullscreen", setMode, stageRef, chatOverlayVisible,
  toggleChatOverlay }`. `WatchStage` attaches `stageRef` and holds the player and a
  chat slot as children.
- [ ] 4.2 Move fullscreen control out of `VideoPlayer.tsx`'s own container: the
  fullscreen button and the `f` shortcut call `requestFullscreen` on `stageRef`, and a
  `fullscreenchange` listener syncs `mode`. Confirm `Escape` and browser-driven exits
  return `mode` to `default`.
- [ ] 4.3 Wrap `app/watch/[videoId]/page.tsx` in `WatchLayoutProvider` + `WatchStage`
  with the player and the `ChatReplay` panel as its children, replacing the current
  ad-hoc grid wrapper.
- [ ] 4.4 Wrap the live branch of `components/live-stream-view.tsx` in
  `WatchLayoutProvider` + `WatchStage` with `LiveStage` and `LiveChat` as its children.
  Apply the same treatment to the waiting-room branch so its chat is bounded too.

## 5. Unify the live surface onto the shared player

- [ ] 5.1 Create `components/video-player/transport-live.tsx`: a live indicator reading
  `atLiveEdge`, rendered active at the edge and inactive when behind, seeking to
  `liveSyncPosition` when activated while behind.
- [ ] 5.2 Add an `overlay` (children) slot to `VideoPlayer.tsx`, rendered above the
  video and below the control bar.
- [ ] 5.3 Add the quality section to `settings-menu.tsx` from the engine's `levels`,
  with an auto entry, calling `setLevel`; hide the section entirely for `mp4` sources.
- [ ] 5.4 Fold the muted-autoplay state into the shared volume control: live sources
  start muted, and a prominent unmute affordance shows while muted and dismisses on
  unmute. Reuse the existing pill treatment.
- [ ] 5.5 Rewrite `components/live-player.tsx` as a thin wrapper that renders
  `VideoPlayer` with an `hls` live source and passes `MobileChromeTopBar` /
  `MobileChromeOverlay` through the overlay slot, keeping portrait detection, the
  `onPortraitChange` callback, the `MOBILE_CHROME_REF_WIDTH` scaling and the
  `max-h-[80vh]` sizing. Delete the `<video controls>` element and its native chrome.
- [ ] 5.6 Move `DisconnectedOverlay` and the viewer-cap states in
  `components/live-stage.tsx` into the overlay slot rather than sibling absolute
  positioning.
- [ ] 5.7 Gate seek behaviour by source: arrow-key seeking and the seek bar are absent
  for live sources; `Space`/`k`, `f` and `m` work identically on both.

## 6. Bounded chat containers

- [ ] 6.1 Remove `min-h-80` from `components/live-chat.tsx` and
  `components/chat-replay.tsx`, and confirm each panel is `flex flex-col` with the
  message list as the only `min-h-0 flex-1 overflow-y-auto` region.
- [ ] 6.2 In `components/live-stream-view.tsx`, replace the `lg:h-[70vh]` wrappers
  (lines 69 and 96) with the shared grid row from `WatchStage`, so the chat column's
  height comes from the row both columns occupy at `lg` and above.
- [ ] 6.3 In `app/watch/[videoId]/page.tsx`, replace the
  `cn(replayExpanded && "lg:h-[70vh]")` wrapper (line 99) the same way, including the
  case where the replay is expanded below `lg`.
- [ ] 6.4 Give `WatchStage` its single-column layout: a `100dvh` grid (with a `vh`
  fallback declaration) where the player row is `auto` and the chat row is `1fr`, so
  the header, any banner and the composer stay outside the scrolling list.
- [ ] 6.5 Confirm `YoutubeVerifyBanner` in `live-chat.tsx` renders between the header
  and the message list, outside the scroll container, so it is never scrolled away.
- [ ] 6.6 Verify sticky-scroll behaviour now that containers overflow: following at the
  bottom, preserved position when scrolled up with the jump pill shown, and the pill
  returning to the bottom and resuming following.

## 7. Fullscreen chat overlay

- [ ] 7.1 Render the chat slot as a translucent overlay pinned to one side of
  `WatchStage` when `mode` is `fullscreen`, keeping the same React element so the chat
  is not remounted across the mode change.
- [ ] 7.2 Add a chat-overlay visibility toggle to the control bar's right slot, shown
  only in `fullscreen` mode, defaulting to visible on the live page and hidden on the
  watch page, held in context and not persisted.
- [ ] 7.3 Verify entering and exiting fullscreen during a live stream preserves the
  chat's loaded messages, scroll position and realtime subscription with no reconnect.

## 8. Verification

- [ ] 8.1 Run `npx tsc --noEmit` and `npm run build`; confirm no type errors and that
  the watch-page bundle does not include hls.js.
- [ ] 8.2 Verify on the live page and the watch page at 375px, 768px and 1440px that a
  chat of several hundred messages scrolls within its container, the page body does not
  grow, and the composer stays visible without scrolling the page.
- [ ] 8.3 Verify at desktop width that the chat column's bottom edge aligns with the
  player column's on both pages.
- [ ] 8.4 Verify on the live page that no native video chrome appears, the live
  indicator reflects at-edge and behind states, jump-to-live rejoins the edge, quality
  can be pinned and returned to auto, muted autoplay starts and unmute is one tap.
- [ ] 8.5 Verify a portrait live stream still renders inside the mobile-chrome frame and
  that the disconnected overlay still appears when the feed goes stale.
- [ ] 8.6 Add a test asserting the chat message list is the scrolling element and the
  page body does not overflow at a narrow viewport, on both the live page and the watch
  page.
- [ ] 8.7 Add a test asserting a non-16:9 landscape VOD renders without cropping, and
  that a live source renders no seek bar while an `mp4` source does.
