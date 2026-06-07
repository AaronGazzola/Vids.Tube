# vod-recording Specification

## Purpose
TBD - created by archiving change add-vod-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Session recording on the VM

The system SHALL record each live session on the VM as fMP4 by remux (no
re-encode), concurrently with live HLS delivery, so that a recording exists for
every published stream.

#### Scenario: Stream is recorded

- **WHEN** a publish is accepted and the stream goes live
- **THEN** MediaMTX writes a session recording to local disk in fMP4 without
  re-encoding the incoming H.264/AAC

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

### Requirement: Processing VOD row on stream end

The system SHALL create a `videos` row in `processing` state when a stream ends,
linked to the originating stream, before the recording upload completes.

#### Scenario: Offline hook creates the processing row

- **WHEN** the shared-secret-guarded `/api/ingest/offline` hook fires for a live
  stream
- **THEN** the system sets the stream `status` to `ended` and inserts a `videos`
  row with `status='processing'`, `source_stream_id` set to that stream, and the
  stream's title

#### Scenario: Forged offline hook changes nothing

- **WHEN** `/api/ingest/offline` is called without the valid shared secret
- **THEN** the system rejects the request and creates no `videos` row

### Requirement: Recording-complete publication hook

The system SHALL expose a shared-secret-guarded `/api/ingest/recording` hook
that marks the VOD ready once its media is uploaded, recording the object
keys, duration, pixel dimensions, and preview-still keys.

#### Scenario: VOD is published

- **WHEN** the finalize script calls `/api/ingest/recording` with the valid
  shared secret, the channel slug, the MP4 and thumbnail object keys, the
  duration, the pixel `width` and `height` (when available), and the array of
  preview-still object keys
- **THEN** the system sets that channel's current `processing` `videos` row
  to `status='ready'`, records `mp4_path`, `thumbnail_path`, `duration_s`,
  `width`, `height`, and `preview_paths`, and stamps `published_at`

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

