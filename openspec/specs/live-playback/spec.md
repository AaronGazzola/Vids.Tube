# live-playback Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Live player rendering

The system SHALL render the shared player component on the home and `/live` pages when
the channel's stream is live, sourced from the stream's `hls_path` as an `hls` source
descriptor with `live` set, and SHALL show an offline state otherwise. The live surface
SHALL NOT use a separate live-only player component, and SHALL NOT expose native
browser video controls.

#### Scenario: Stream is live and viewer admitted

- **WHEN** the channel's stream is live and the viewer is within the concurrent
  cap
- **THEN** the page mounts the shared player with an `hls` live source descriptor and
  plays the live HLS with the custom control bar

#### Scenario: No live stream

- **WHEN** no stream is live for the channel
- **THEN** the page shows the offline "next stream" card instead of a player

#### Scenario: Native controls are absent

- **WHEN** a viewer watches a live stream in any supported browser
- **THEN** no browser-default video control bar is rendered

### Requirement: Playback recovery

The player SHALL retry when the HLS playlist is not yet available or is briefly
interrupted, and SHALL return to the offline state when the stream ends. While the feed
is interrupted the player SHALL surface a buffering or reconnecting state rather than
holding a frozen frame with no indication.

#### Scenario: HLS not ready immediately after going live

- **WHEN** the HLS playlist is momentarily unavailable just after the stream goes
  live
- **THEN** the player retries until segments become available and then plays

#### Scenario: Stream ends during playback

- **WHEN** a live stream ends
- **THEN** the player stops and the page returns to the offline "next stream" card

#### Scenario: Feed interruption is visible to the viewer

- **WHEN** live playback stalls because segments stop arriving
- **THEN** the player shows a buffering or reconnecting indication until playback
  resumes or the disconnected overlay takes over

### Requirement: Live surface chrome is composed, not embedded

The live surface SHALL supply its non-playback chrome — the portrait mobile-chrome
frame, the disconnected overlay, and the viewer-cap states — through the shared player's
overlay slot. Portrait detection SHALL continue to drive the mobile-chrome frame from
the video's intrinsic dimensions, and the frame SHALL remain aligned to the rendered
video as the player resizes.

#### Scenario: Portrait stream renders inside the mobile-chrome frame

- **WHEN** a live stream's intrinsic dimensions report portrait orientation and the
  channel supplies mobile-chrome details
- **THEN** the mobile-chrome top bar and overlay render around the video, scaled to the
  rendered video width

#### Scenario: Landscape stream renders without the frame

- **WHEN** a live stream's intrinsic dimensions report landscape orientation
- **THEN** no mobile-chrome frame is rendered and the video fills the player normally

#### Scenario: Disconnected feed overlays the player

- **WHEN** the stream's heartbeat has gone stale while the page is open
- **THEN** the disconnected overlay renders above the video through the overlay slot,
  and chat remains available

#### Scenario: Viewer cap replaces the player

- **WHEN** the concurrent viewer cap is reached for a viewer who is not admitted
- **THEN** the stream-full state renders in place of the player

