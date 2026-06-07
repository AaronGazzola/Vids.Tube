# stream-pipeline Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Stream key storage isolation

The system SHALL store each channel's RTMP stream key in a dedicated
`stream_keys` table that is not exposed through the public `channels` read path,
protected by row-level security so that only the channel's owner can read or
rotate the key.

#### Scenario: Anonymous or non-owner cannot read the key

- **WHEN** an anonymous visitor or a non-owner authenticated user queries stream
  key data
- **THEN** row-level security returns no `stream_keys` row

#### Scenario: Owner reads their key

- **WHEN** the channel owner requests their stream key through the owner-checked
  server action
- **THEN** the system returns the current key

### Requirement: Stream key regeneration

The system SHALL allow the channel owner to regenerate their stream key,
replacing the previous value so the old key no longer authorizes publishing.

#### Scenario: Owner regenerates the key

- **WHEN** the owner triggers regeneration
- **THEN** the system stores a newly generated key and a subsequent publish using
  the previous key is rejected

### Requirement: RTMP publish authentication

MediaMTX SHALL authenticate every RTMP publish against the channel's stored
stream key by calling the ingest-auth route before accepting the stream; the
route validates the key with the admin (service-role) client.

#### Scenario: Valid stream key

- **WHEN** a publish attempt presents a stream key matching a `stream_keys` row
- **THEN** the ingest-auth route returns success and MediaMTX accepts the publish

#### Scenario: Invalid stream key

- **WHEN** a publish attempt presents an unknown stream key
- **THEN** the ingest-auth route returns unauthorized and MediaMTX rejects the
  publish

### Requirement: Live and offline state hooks

The system SHALL maintain a per-broadcast `streams` row when MediaMTX reports
stream readiness, via ingest routes guarded by a shared-secret header. Each
distinct broadcast session SHALL be its own `streams` row: the ready hook SHALL
reuse the channel's most-recent row ONLY when that row represents an ongoing
session — its `status` is `live` AND its `last_seen_at` is within the staleness
threshold (a reconnect or keep-alive). In every other case (no row exists, or
the most-recent row is `ended`, `idle`, or a stale `live` row) the ready hook
SHALL insert a NEW row with a fresh `started_at` and `last_seen_at`. When the
ready hook starts a new session because the prior row was a stale `live` row, it
SHALL also set that orphaned row's `status` to `ended` so live-state reads stay
consistent.

#### Scenario: First broadcast goes live

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel has no existing stream row
- **THEN** the system inserts a new `streams` row with `status` `live` and records
  `started_at`, `hls_path`, and `last_seen_at`

#### Scenario: Reconnect within an ongoing session

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row is `live` with a `last_seen_at` within the staleness
  threshold
- **THEN** the system updates that same row's `hls_path` and `last_seen_at`
  without changing its `id` or `started_at`

#### Scenario: New broadcast after a prior session ended

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row has `status` `ended` (or `idle`)
- **THEN** the system inserts a NEW `streams` row with a new `id`, `status` `live`,
  and a fresh `started_at` and `last_seen_at`, leaving the prior row untouched

#### Scenario: New broadcast after a stale live row

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row is `live` but its `last_seen_at` is older than the
  staleness threshold
- **THEN** the system sets that orphaned row's `status` to `ended` and inserts a
  NEW `streams` row with a new `id`, `status` `live`, and a fresh `started_at`

#### Scenario: Stream ends

- **WHEN** MediaMTX posts the not-ready hook with the valid shared secret
- **THEN** the system sets the current session's `status` to `ended` and records
  `ended_at`

#### Scenario: Forged hook call

- **WHEN** an ingest route is called without the valid shared secret
- **THEN** the system rejects the request and changes no stream state

### Requirement: HLS remux delivery

The system SHALL serve a single HLS rendition remuxed from the incoming RTMP
without re-encoding, over TLS at the configured stream host.

#### Scenario: Live HLS is playable

- **WHEN** a stream is live
- **THEN** its HLS playlist is reachable over TLS at the stream host and plays in
  an HLS client

### Requirement: Edge concurrency cap

The edge (Caddy or MediaMTX) SHALL enforce a hard maximum on concurrent HLS
connections to bound egress independently of the application-level viewer cap.

#### Scenario: Edge connection limit reached

- **WHEN** concurrent HLS connections reach the configured edge maximum
- **THEN** additional connection attempts are refused at the edge

### Requirement: Live-state staleness guard

The system SHALL treat a stream marked `live` whose `last_seen_at` is older than
the staleness threshold as not live for read purposes.

#### Scenario: Ingest crashes without firing the offline hook

- **WHEN** a stream row is `live` but its `last_seen_at` is older than the
  staleness threshold
- **THEN** read queries report the stream as offline

