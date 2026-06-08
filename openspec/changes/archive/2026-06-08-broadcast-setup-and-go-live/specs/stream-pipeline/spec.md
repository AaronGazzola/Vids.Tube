## MODIFIED Requirements

### Requirement: Live and offline state hooks

The system SHALL maintain a per-broadcast `streams` row when MediaMTX reports
stream readiness, via ingest routes guarded by a shared-secret header. The ready
hook SHALL land a new session in the private `preview` state, NOT public `live`:
a `preview` session is visible only to the owner and is promoted to public `live`
later by an explicit owner action (see the `broadcast-setup` capability). Each
distinct broadcast session SHALL be its own `streams` row: the ready hook SHALL
reuse the channel's most-recent row ONLY when that row represents an ongoing
session — its `status` is `preview` or `live` AND its `last_seen_at` is within the
staleness threshold (a reconnect or keep-alive). In every other case (no row
exists, or the most-recent row is `ended`, `idle`, or a stale `preview`/`live`
row) the ready hook SHALL insert a NEW row with `status` `preview` and a fresh
`started_at` and `last_seen_at`. When the ready hook starts a new session because
the prior row was a stale `preview`/`live` row, it SHALL also set that orphaned
row's `status` to `ended` so live-state reads stay consistent.

#### Scenario: First broadcast lands in preview

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel has no existing stream row
- **THEN** the system inserts a new `streams` row with `status` `preview` and
  records `started_at`, `hls_path`, and `last_seen_at`, and no public viewer sees
  the stream

#### Scenario: Reconnect within an ongoing session

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row is `preview` or `live` with a `last_seen_at` within
  the staleness threshold
- **THEN** the system updates that same row's `hls_path` and `last_seen_at`
  without changing its `id`, `status`, or `started_at`

#### Scenario: New broadcast after a prior session ended

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row has `status` `ended` (or `idle`)
- **THEN** the system inserts a NEW `streams` row with a new `id`, `status`
  `preview`, and a fresh `started_at` and `last_seen_at`, leaving the prior row
  untouched

#### Scenario: New broadcast after a stale session row

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's most-recent row is `preview` or `live` but its `last_seen_at` is older
  than the staleness threshold
- **THEN** the system sets that orphaned row's `status` to `ended` and inserts a
  NEW `streams` row with a new `id`, `status` `preview`, and a fresh `started_at`

#### Scenario: Stream ends

- **WHEN** MediaMTX posts the not-ready hook with the valid shared secret
- **THEN** the system sets the current session's `status` to `ended` and records
  `ended_at`

#### Scenario: Forged hook call

- **WHEN** an ingest route is called without the valid shared secret
- **THEN** the system rejects the request and changes no stream state
