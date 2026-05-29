## ADDED Requirements

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
single seekable MP4 with `ffmpeg -c copy`, extract a poster thumbnail, and upload
both to the R2 VOD bucket under deterministic keys.

#### Scenario: Recording is finalized and uploaded

- **WHEN** the stream's `runOnNotReady` fires
- **THEN** the finalize script produces a single MP4 and a thumbnail image and
  uploads both to `R2_BUCKET_VOD` at `vod/<channel_slug>/<stream_id>.mp4` and
  `vod/<channel_slug>/<stream_id>.jpg`

#### Scenario: Upload failure leaves no public VOD

- **WHEN** the finalize script fails to upload the MP4
- **THEN** the recording-complete hook is not called and the `videos` row remains
  `processing`, so no broken VOD is shown to viewers

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

The system SHALL expose a shared-secret-guarded `/api/ingest/recording` hook that
marks the VOD ready once its media is uploaded, recording the object keys and
duration.

#### Scenario: VOD is published

- **WHEN** the finalize script calls `/api/ingest/recording` with the valid
  shared secret, the stream id, the MP4 and thumbnail object keys, and the
  duration
- **THEN** the system sets the corresponding `videos` row to `status='ready'`,
  records `mp4_path`, `thumbnail_path`, `duration_s`, and stamps `published_at`

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
