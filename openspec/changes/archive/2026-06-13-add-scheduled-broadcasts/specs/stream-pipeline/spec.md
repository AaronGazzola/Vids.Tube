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
staleness threshold (a reconnect or keep-alive). An ongoing session SHALL take
precedence over any scheduled broadcast. When there is no ongoing session, the ready
hook SHALL check for a **claimable scheduled broadcast** — the `scheduled` row with
the soonest `scheduled_start_at` whose start time is in the future or within a grace
window after it — and SHALL **claim** it: update that row to `status` `preview` with a
fresh `hls_path`, `started_at`, and `last_seen_at`, preserving its authored `title`,
`description`, and `thumbnail_path`. A `scheduled` row whose start time is past by more
than the grace window is **missed** and SHALL NOT be claimed. In every other case (no
row exists, or the most-recent row is `ended`, `idle`, or a stale `preview`/`live` row
and no claimable scheduled broadcast exists) the ready hook SHALL insert a NEW row with
`status` `preview` and a fresh `started_at` and `last_seen_at`. When the ready hook
starts a new session because the prior row was a stale `preview`/`live` row, it SHALL
also set that orphaned row's `status` to `ended` so live-state reads stay consistent.
Claiming a `scheduled` row SHALL keep go-live manual — claiming only moves
`scheduled → preview`; the public flip to `live` remains an explicit owner action.

#### Scenario: First broadcast lands in preview

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel has no existing stream row
- **THEN** the system inserts a new `streams` row with `status` `preview` and
  records `started_at`, `hls_path`, and `last_seen_at`, and no public viewer sees
  the stream

#### Scenario: Encoder claims the nearest upcoming scheduled broadcast

- **WHEN** MediaMTX posts the ready hook with the valid shared secret, there is no
  ongoing session, and one or more claimable `scheduled` broadcasts exist
- **THEN** the system claims the one with the soonest `scheduled_start_at`, updating
  that row to `status` `preview` with a fresh `hls_path`, `started_at`, and
  `last_seen_at`, preserving its `title`, `description`, and `thumbnail_path`, and no
  public viewer sees the stream until the owner goes live

#### Scenario: Ongoing session takes precedence over a scheduled broadcast

- **WHEN** MediaMTX posts the ready hook with the valid shared secret, the channel's
  most-recent row is an ongoing-and-fresh `preview`/`live` session, and a claimable
  scheduled broadcast also exists
- **THEN** the system reconnects to the ongoing session (updating its `hls_path` and
  `last_seen_at`) and does not claim the scheduled broadcast

#### Scenario: Missed scheduled broadcast is not claimed

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the only
  `scheduled` row's start time is past by more than the grace window
- **THEN** the system does not claim it and instead inserts a NEW `preview` row for a
  fresh ad-hoc session, leaving the missed row untouched

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
