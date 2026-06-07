# live-playback Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Live player rendering

The system SHALL render an HLS player on the home and `/live` pages when the
channel's stream is live, sourced from the stream's `hls_path`, and SHALL show an
offline state otherwise.

#### Scenario: Stream is live and viewer admitted

- **WHEN** the channel's stream is live and the viewer is within the concurrent
  cap
- **THEN** the page mounts an hls.js player that plays the live HLS

#### Scenario: No live stream

- **WHEN** no stream is live for the channel
- **THEN** the page shows the offline "next stream" card instead of a player

### Requirement: Playback recovery

The player SHALL retry when the HLS playlist is not yet available or is briefly
interrupted, and SHALL return to the offline state when the stream ends.

#### Scenario: HLS not ready immediately after going live

- **WHEN** the HLS playlist is momentarily unavailable just after the stream goes
  live
- **THEN** the player retries until segments become available and then plays

#### Scenario: Stream ends during playback

- **WHEN** a live stream ends
- **THEN** the player stops and the page returns to the offline "next stream" card

