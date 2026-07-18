## MODIFIED Requirements

### Requirement: Session recording on the VM

The system SHALL record only the **public (live) portion** of each session on the VM
as fMP4 by remux (no re-encode), concurrently with live HLS delivery. Footage
captured while the session is `preview` (before the owner presses Go live) SHALL be
excluded from the finalized VOD, using the stream's `live_at` marker as the start
boundary — either by starting the recording at go-live, or by trimming everything
before `live_at` during finalize. A broadcast that spans one or more encoder
disconnects (each producing a separate recording segment) SHALL be finalized by
**concatenating all segments from `live_at` onward into a single MP4**; the
disconnected periods are simply absent (jump cuts), never black filler.

#### Scenario: Only live footage is recorded

- **WHEN** the owner connects the encoder (preview) and later presses Go live
- **THEN** the finalized VOD begins at `live_at` and contains no preview footage

#### Scenario: Preview-only session produces no VOD

- **WHEN** a session is connected in `preview` and disconnected without ever going live
- **THEN** no recording is finalized and no VOD row is created

#### Scenario: Reconnects produce one VOD with jump cuts

- **WHEN** a live broadcast disconnects and reconnects one or more times before End
- **THEN** the finalized VOD is a single MP4 concatenating every segment since
  `live_at`, with a jump cut (no black) at each reconnect

#### Scenario: Recording does not disrupt live delivery

- **WHEN** recording is active during a live stream
- **THEN** the live LL-HLS playlist remains reachable and playable throughout

### Requirement: Finalize on End, not on disconnect

The system SHALL finalize the VOD when the owner ends the broadcast, not on encoder
disconnect. The processing VOD row created at go-live SHALL become visible (ready)
only once the stream is `ended`; a disconnect that is later reconnected SHALL NOT
publish a partial VOD.

#### Scenario: Disconnect alone does not publish a VOD

- **WHEN** the encoder disconnects mid-broadcast and the owner has not pressed End
- **THEN** no VOD is published; the broadcast remains `live` in a disconnected state

#### Scenario: End publishes the concatenated VOD

- **WHEN** the owner presses End after the encoder has disconnected
- **THEN** the segments since `live_at` are concatenated, uploaded, and the VOD row
  flips to ready
