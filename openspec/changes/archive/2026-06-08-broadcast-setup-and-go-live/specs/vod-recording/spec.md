## MODIFIED Requirements

### Requirement: Processing VOD row on stream end

The system SHALL create a `videos` row in `processing` state when a broadcast
that was publicly `live` ends, linked to the originating stream, before the
recording upload completes. The processing row SHALL inherit the broadcast's
`title`, `description`, and `thumbnail_path`. A session that ends from `preview`
without ever having gone public `live` SHALL NOT create a `videos` row.

#### Scenario: Offline hook creates the processing row

- **WHEN** the shared-secret-guarded `/api/ingest/offline` hook fires for a
  broadcast that was publicly `live`
- **THEN** the system sets the stream `status` to `ended` and inserts a `videos`
  row with `status='processing'`, `source_stream_id` set to that stream, and the
  stream's `title`, `description`, and `thumbnail_path`

#### Scenario: Preview-only session leaves no VOD

- **WHEN** `/api/ingest/offline` fires for a session that is in `preview` and was
  never promoted to public `live`
- **THEN** the system sets the stream `status` to `ended` and creates no `videos`
  row

#### Scenario: Forged offline hook changes nothing

- **WHEN** `/api/ingest/offline` is called without the valid shared secret
- **THEN** the system rejects the request and creates no `videos` row

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
