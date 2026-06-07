## MODIFIED Requirements

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
