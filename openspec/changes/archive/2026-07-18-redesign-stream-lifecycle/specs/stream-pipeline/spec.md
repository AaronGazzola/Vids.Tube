## MODIFIED Requirements

### Requirement: Live and offline state hooks

The system SHALL maintain a per-broadcast `streams` row when MediaMTX reports
stream readiness, via ingest routes guarded by a shared-secret header. The ready
hook SHALL land a new session in the private `preview` state, NOT public `live`,
promoted to public `live` later by an explicit owner action (see `broadcast-setup`
and `stream-lifecycle`). The ready hook SHALL resolve the channel's single **active**
row (`status IN ('draft','scheduled','preview','live')`) and:

- **Reconnect** — if the active row is `preview` or `live` with a fresh
  `last_seen_at`, update its `hls_path` and `last_seen_at` without changing `id`,
  `status`, or `started_at`.
- **Claim** — if the active row is `draft` or `scheduled`, update it to `preview`
  with fresh `hls_path`, `started_at`, `last_seen_at`, preserving `scheduled_start_at`,
  `created_in_ui`, `title`, `description`, `thumbnail_path`, and configured overlay
  settings. Claiming keeps go-live manual.
- **New (ad-hoc)** — if no active row exists, insert a NEW `preview` row with
  `created_in_ui=false` and fresh `started_at`/`last_seen_at`.

The not-ready hook SHALL NOT blanketly end the session. It SHALL instead: for a
`preview` row, revert it to `scheduled` (if dated), `draft` (if `created_in_ui=true`),
or delete it (ad-hoc), clearing `hls_path`/`started_at`/`live_at` and creating no VOD;
for a `live` row, **leave it `live` and open a reconnect gap** (never end it — only
the owner's End action ends a live broadcast); for `draft`/`scheduled`/none, do
nothing. The ready hook SHALL close any open reconnect gap when it reconnects a
`live` row. The route SHALL be idempotent across repeated not-ready fires (a second
not-ready with a gap already open SHALL not open another).

#### Scenario: Encoder claims the active draft or scheduled broadcast

- **WHEN** MediaMTX posts the ready hook with the valid shared secret and the
  channel's active row is `draft` or `scheduled`
- **THEN** the system claims it to `preview` with fresh `hls_path`/`started_at`/
  `last_seen_at`, preserving its datetime, `created_in_ui`, and authored settings,
  and no public viewer sees the feed until go-live

#### Scenario: Encoder-first ad-hoc session

- **WHEN** MediaMTX posts the ready hook and the channel has no active row
- **THEN** the system inserts a NEW `preview` row with `created_in_ui=false`,
  private to the owner

#### Scenario: Reconnect within an ongoing session

- **WHEN** MediaMTX posts the ready hook and the active row is `preview` or `live`
  with a fresh `last_seen_at`
- **THEN** the system updates that row's `hls_path` and `last_seen_at` without
  changing `id`, `status`, or `started_at`

#### Scenario: Preview disconnect reverts, not ends

- **WHEN** MediaMTX posts the not-ready hook and the active row is `preview`
- **THEN** the system reverts it to `scheduled`/`draft` or deletes it (ad-hoc),
  clears the feed fields, and creates no VOD

#### Scenario: Live disconnect keeps the stream live and opens a gap

- **WHEN** MediaMTX posts the not-ready hook and the active row is `live`
- **THEN** the system leaves it `live`, creates no VOD, and opens a reconnect gap
  (recording the disconnect time) that the next ready hook closes

#### Scenario: Forged hook call

- **WHEN** an ingest route is called without the valid shared secret
- **THEN** the system rejects the request and changes no stream state
