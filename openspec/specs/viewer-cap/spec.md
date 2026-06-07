# viewer-cap Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Concurrent viewer cap for all viewers

The system SHALL limit concurrent live viewers to the stream's `max_viewers`
(default 25), applied identically to authenticated and anonymous viewers, using
Supabase Realtime Presence.

#### Scenario: Viewer joins under the cap

- **WHEN** a viewer opens a live stream whose present viewer count is below
  `max_viewers`
- **THEN** the viewer is admitted and the player mounts

#### Scenario: Viewer joins at the cap

- **WHEN** a viewer opens a live stream whose present viewer count is already at
  `max_viewers`
- **THEN** the viewer is shown a "stream is full" wall instead of the player

#### Scenario: Cap applies equally regardless of auth

- **WHEN** an anonymous viewer and an authenticated viewer each attempt to join
- **THEN** the system applies the same admission rule to both

### Requirement: Deterministic admission at the cap boundary

The system SHALL decide admission by a deterministic ordering of present members
so that the marginal viewer receives a stable result rather than a flickering
player.

#### Scenario: Membership sits at the boundary

- **WHEN** presence membership is at the `max_viewers` boundary
- **THEN** admission is decided by member join order, yielding a stable
  admitted/blocked outcome per viewer

### Requirement: Edge hard backstop

The application-level cap SHALL be backstopped by the edge concurrency cap (see
`stream-pipeline`) so that bypassing the application cannot exceed bounded
concurrency.

#### Scenario: Client fetches HLS directly, bypassing the app

- **WHEN** a client requests the raw HLS playlist without going through the
  application
- **THEN** total concurrent HLS connections remain bounded by the edge cap

