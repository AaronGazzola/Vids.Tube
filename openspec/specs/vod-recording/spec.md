# vod-recording Specification

## Purpose
TBD - created by archiving change add-vod-pipeline. Update Purpose after archive.
## Requirements
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

### Requirement: Finalize and upload on stream end

The system SHALL, when a stream ends, concatenate the session recording into a
single seekable MP4 with `ffmpeg -c copy`, extract a poster thumbnail, probe
the recording's display pixel dimensions (accounting for rotation metadata),
extract a set of evenly-spaced preview stills, and upload all media to the R2
VOD bucket under deterministic keys.

#### Scenario: Recording is finalized and uploaded

- **WHEN** the stream's `runOnNotReady` fires
- **THEN** the finalize script produces a single MP4, a poster thumbnail image,
  and 4–6 evenly-spaced preview stills, and uploads all of them to
  `R2_BUCKET_VOD` at `vod/<channel_slug>/<stream_id>.mp4`,
  `vod/<channel_slug>/<stream_id>.jpg`, and
  `vod/<channel_slug>/<stream_id>/preview-<n>.jpg`

#### Scenario: Dimensions are probed as display orientation

- **WHEN** the finalize script runs
- **THEN** it captures the recording's `width` and `height` via `ffprobe` and,
  when the stream carries a rotation of ±90° (via display-matrix side data or a
  rotate tag), it swaps the coded width and height so the reported dimensions
  describe the displayed orientation, then includes them in the call to the
  recording-complete hook

#### Scenario: Portrait recording reports portrait dimensions

- **WHEN** a vertical (portrait) stream is recorded, whether stored as a true
  portrait raster or as a rotated landscape raster with rotation metadata
- **THEN** the dimensions sent to the recording hook satisfy `height > width`

#### Scenario: Dimension probing fails

- **WHEN** `ffprobe` fails to return usable dimensions
- **THEN** the finalize script omits `width` and `height` from the hook payload
  (rather than aborting) so the VOD can still be published, and the player
  derives orientation from the video's runtime intrinsic dimensions

#### Scenario: Upload failure leaves no public VOD

- **WHEN** the finalize script fails to upload the MP4
- **THEN** the recording-complete hook is not called and the `videos` row
  remains `processing`, so no broken VOD is shown to viewers

### Requirement: Processing VOD row at go-live

The system SHALL create a `videos` row in `processing` state at go-live, linked to
the originating stream, so the VM finalize (which can fire on any disconnect) always
has a row to attach the recording to. The processing row SHALL inherit the
broadcast's `title`, `description`, and `thumbnail_path`, and SHALL stay hidden
(processing) until the broadcast is ended. A session that disconnects from `preview`
without ever having gone public `live` SHALL NOT create a `videos` row.

#### Scenario: Go-live creates the processing row

- **WHEN** the owner goes live from `preview`
- **THEN** the system inserts a `videos` row with `status='processing'`,
  `source_stream_id` set to that stream, and the stream's `title`, `description`,
  and `thumbnail_path`

#### Scenario: Preview-only session leaves no VOD

- **WHEN** a session disconnects from `preview` without ever going public `live`
- **THEN** no `videos` row exists for it

#### Scenario: Forged offline hook changes nothing

- **WHEN** `/api/ingest/offline` is called without the valid shared secret
- **THEN** the system rejects the request and changes no stream or `videos` row

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

### Requirement: Recording-complete publication hook

The system SHALL expose a shared-secret-guarded `/api/ingest/recording` hook
that marks the VOD ready once its media is uploaded, recording the object
keys, duration, pixel dimensions, and preview-still keys. The hook SHALL NOT
overwrite an owner-set custom `thumbnail_path` with the machine-extracted
thumbnail; the custom thumbnail takes precedence.

#### Scenario: VOD is published

- **WHEN** the finalize script calls `/api/ingest/recording` with the valid
  shared secret, the channel slug, the MP4 and thumbnail object keys, the
  duration, the pixel `width` and `height` (when available), and the array of
  preview-still object keys
- **THEN** the system sets that channel's current `processing` `videos` row
  to `status='ready'`, records `mp4_path`, `duration_s`, `width`, `height`, and
  `preview_paths`, stamps `published_at`, and records `thumbnail_path` only when
  the row does not already have an owner-set custom thumbnail

#### Scenario: Custom thumbnail is preserved

- **WHEN** the recording hook fires for a VOD whose `thumbnail_path` was already
  set by the owner (custom thumbnail)
- **THEN** the system publishes the VOD without replacing that `thumbnail_path`
  with the auto-extracted thumbnail

#### Scenario: Hook called without dimension or preview fields

- **WHEN** the recording hook is called with a valid secret but without
  `width`, `height`, or `preview_paths` (legacy payload shape)
- **THEN** the system still publishes the VOD; the missing columns remain
  `null` / empty array

#### Scenario: No processing VOD for the channel

- **WHEN** `/api/ingest/recording` is called with a valid secret but the
  channel has no `processing` `videos` row
- **THEN** the system returns not-found and changes no `videos` row

#### Scenario: Forged recording hook changes nothing

- **WHEN** `/api/ingest/recording` is called without the valid shared secret
- **THEN** the system rejects the request and changes no `videos` row

### Requirement: VOD write isolation

The system SHALL restrict all `videos` writes to the service-role ingest routes;
no client role may insert, update, or delete a `videos` row.

#### Scenario: Client cannot write videos

- **WHEN** an anonymous or authenticated client attempts to insert or update a
  `videos` row directly
- **THEN** row-level security rejects the write

