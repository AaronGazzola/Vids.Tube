## MODIFIED Requirements

### Requirement: Finalize and upload on stream end

The system SHALL, when a stream ends, concatenate the session recording into a
single seekable MP4 with `ffmpeg -c copy`, extract a poster thumbnail, probe
the recording's pixel dimensions, extract a set of evenly-spaced preview
stills, and upload all media to the R2 VOD bucket under deterministic keys.

#### Scenario: Recording is finalized and uploaded

- **WHEN** the stream's `runOnNotReady` fires
- **THEN** the finalize script produces a single MP4, a poster thumbnail image,
  and 4–6 evenly-spaced preview stills, and uploads all of them to
  `R2_BUCKET_VOD` at `vod/<channel_slug>/<stream_id>.mp4`,
  `vod/<channel_slug>/<stream_id>.jpg`, and
  `vod/<channel_slug>/<stream_id>/preview-<n>.jpg`

#### Scenario: Dimensions are probed

- **WHEN** the finalize script runs
- **THEN** it captures the recording's pixel `width` and `height` via
  `ffprobe` and includes them in the call to the recording-complete hook

#### Scenario: Dimension probing fails

- **WHEN** `ffprobe` fails to return usable dimensions
- **THEN** the finalize script omits `width` and `height` from the hook
  payload (rather than aborting) so the VOD can still be published, and the
  player falls back to 16:9 at render time

#### Scenario: Upload failure leaves no public VOD

- **WHEN** the finalize script fails to upload the MP4
- **THEN** the recording-complete hook is not called and the `videos` row
  remains `processing`, so no broken VOD is shown to viewers

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
