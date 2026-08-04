# unified-video-player Specification

## Purpose
TBD - created by archiving change unified-player-and-chat-layout. Update Purpose after archive.
## Requirements
### Requirement: Single player component for all sources

The system SHALL render all video playback — live streams and VODs — through one
player component. The component SHALL accept a source descriptor that discriminates
the source type, and SHALL derive playback behaviour from that descriptor rather than
from a caller-supplied styling flag:

- `{ kind: "mp4", src, poster? }` for VOD playback
- `{ kind: "hls", src, live }` for stream playback

A separate live-only player component SHALL NOT exist.

#### Scenario: VOD source renders the shared player

- **WHEN** the watch page mounts the player with an `mp4` source descriptor
- **THEN** the shared player attaches the MP4 to the `<video>` element and renders the
  shared control bar with the VOD transport region

#### Scenario: Live source renders the same shared player

- **WHEN** the live page mounts the player with an `hls` source descriptor whose
  `live` is true
- **THEN** the same shared player attaches the stream via hls.js and renders the shared
  control bar with the live transport region

#### Scenario: Native browser controls are suppressed on every source

- **WHEN** the player renders any source type
- **THEN** the `<video>` element does not carry the `controls` attribute and no
  browser-default video chrome is visible

### Requirement: Media source attachment and recovery

The player SHALL attach media according to the source descriptor and SHALL tear the
attachment down when the descriptor changes or the player unmounts. For `hls` sources
the player SHALL load hls.js dynamically so that a page rendering only `mp4` sources
does not load it, and SHALL recover from non-fatal and recoverable fatal errors:
network errors by restarting the load, media errors by attempting media recovery, and
otherwise by destroying the instance.

#### Scenario: HLS is not loaded for a VOD-only page

- **WHEN** the watch page loads and mounts the player with an `mp4` source
- **THEN** hls.js is not loaded

#### Scenario: Native HLS support is preferred

- **WHEN** the browser reports it can play `application/vnd.apple.mpegurl` natively
- **THEN** the player assigns the source directly instead of instantiating hls.js

#### Scenario: Network error during live playback

- **WHEN** a fatal network error is reported during HLS playback
- **THEN** the player restarts loading rather than tearing down playback

#### Scenario: Source descriptor changes

- **WHEN** the player is rendered with a different source descriptor
- **THEN** the previous attachment is destroyed and its listeners removed before the
  new source is attached

### Requirement: Slot-based control bar

The player's control bar SHALL be composed from named slots rather than branching on
source type inside a single control component. The slots SHALL be:

- `transport` — the source-specific progress region
- `left` — play/pause and volume
- `right` — settings and fullscreen

Controls that apply to every source (play/pause, volume, mute, fullscreen) SHALL be
implemented once and reused across source types.

#### Scenario: Shared controls are common to both source types

- **WHEN** a viewer uses play/pause, the volume slider, mute, or fullscreen
- **THEN** the same control implementation handles the interaction regardless of
  whether the source is a VOD or a live stream

#### Scenario: Transport region differs by source type

- **WHEN** the source is an `mp4`
- **THEN** the transport slot contains the seek bar and elapsed/total time

#### Scenario: Live transport replaces the seek bar

- **WHEN** the source is a live `hls`
- **THEN** the transport slot contains the live indicator, and no seek bar is rendered

### Requirement: Live edge indication and rejoin

For live sources the player SHALL present a live indicator whose state reflects whether
playback is at the live edge. Live-edge state SHALL be derived from the difference
between the stream's live sync position and the current playback position, not stored
as independent state. When playback is behind the live edge, activating the indicator
SHALL seek to the live edge.

#### Scenario: Playback is at the live edge

- **WHEN** the current position is within the live-edge tolerance of the live sync
  position
- **THEN** the live indicator renders in its active state

#### Scenario: Playback has drifted behind

- **WHEN** the current position falls further behind the live sync position than the
  tolerance
- **THEN** the live indicator renders in its inactive (behind) state and is actionable

#### Scenario: Viewer rejoins the live edge

- **WHEN** a viewer activates the live indicator while behind the live edge
- **THEN** playback seeks to the live sync position and the indicator returns to its
  active state

### Requirement: Quality selection for live sources

For live sources the player SHALL expose the renditions reported by the HLS manifest in
the settings menu, including an automatic option, and SHALL apply the viewer's choice
to the running stream. VOD sources, which are single-rendition MP4s, SHALL NOT show a
quality control.

#### Scenario: Viewer pins a rendition

- **WHEN** a viewer selects a specific rendition from the settings menu during live
  playback
- **THEN** the player switches to that rendition and the menu reflects the selection

#### Scenario: Viewer returns to automatic

- **WHEN** a viewer selects the automatic option
- **THEN** adaptive bitrate selection resumes and the menu reflects the automatic state

#### Scenario: No quality control for a VOD

- **WHEN** the source is an `mp4`
- **THEN** the settings menu contains no quality section

### Requirement: Consolidated settings menu

The player SHALL present source-appropriate settings in a single menu rather than as
separate one-off menus. The menu SHALL contain playback speed for `mp4` sources and
quality for live `hls` sources.

#### Scenario: VOD settings menu

- **WHEN** a viewer opens the settings menu during VOD playback
- **THEN** the menu offers playback speed with the options `0.5x`, `0.75x`, `1x`,
  `1.25x`, `1.5x`, `2x`

#### Scenario: Live settings menu

- **WHEN** a viewer opens the settings menu during live playback
- **THEN** the menu offers quality selection

### Requirement: Muted autoplay and unmute affordance

For live sources the player SHALL begin muted so autoplay is permitted, and SHALL
present a prominent unmute affordance while playback remains muted. Activating it SHALL
unmute and continue playback.

#### Scenario: Live playback starts muted

- **WHEN** a viewer opens a live stream
- **THEN** playback starts muted and an unmute affordance is visible

#### Scenario: Viewer unmutes

- **WHEN** the viewer activates the unmute affordance
- **THEN** audio is enabled, playback continues, and the affordance is dismissed

### Requirement: Buffering and error states

The player SHALL show a buffering indicator while the media element is waiting for
data, and SHALL show an error state when a source cannot be played, on every source
type. A failed or stalled source SHALL NOT present as an inert black rectangle.

#### Scenario: Playback stalls

- **WHEN** the media element stalls waiting for data
- **THEN** the player shows a buffering indicator, which clears when playback resumes

#### Scenario: Source cannot be played

- **WHEN** the source fails unrecoverably
- **THEN** the player shows an error state describing that playback is unavailable

### Requirement: Overlay slot for surface-specific chrome

The player SHALL expose an overlay slot rendered above the video and below the control
bar, so that chrome belonging to a surface rather than to playback is composed in by
the caller. The player SHALL NOT contain surface-specific chrome itself.

#### Scenario: Live surface composes its chrome

- **WHEN** the live page renders the player for a portrait stream
- **THEN** the mobile-chrome frame, the disconnected overlay, and viewer-cap states are
  supplied through the overlay slot rather than implemented inside the player

#### Scenario: Watch page supplies no overlay

- **WHEN** the watch page renders the player
- **THEN** the overlay slot is empty and playback is unaffected

### Requirement: Player keyboard shortcuts across sources

The player SHALL respond to keyboard shortcuts whenever it has focus, for both source
types, except where a shortcut is meaningless for the source:

- `Space` / `k` — play / pause
- `f` — toggle fullscreen
- `m` — toggle mute
- `Left Arrow` / `Right Arrow` — seek back / forward 5 seconds (`mp4` sources only)

#### Scenario: Live playback responds to shared shortcuts

- **WHEN** the player has focus during live playback and the viewer presses `f`, `m`,
  or `Space`
- **THEN** fullscreen, mute, and play/pause respond as they do for a VOD

#### Scenario: Seek shortcuts do nothing on a live source

- **WHEN** the player has focus during live playback and the viewer presses an arrow key
- **THEN** the playhead is unchanged

