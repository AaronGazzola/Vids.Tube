## ADDED Requirements

### Requirement: Stream state machine

The system SHALL model a broadcast as one `streams` row whose `status` is one of
`draft`, `scheduled`, `preview`, `live`, or `ended`, advancing only along:
`draft|scheduled → preview → live → ended`, plus preview reverting to its origin on
encoder disconnect and any pre-live state being discarded. `draft` is an
owner-created broadcast with no `scheduled_start_at`; `scheduled` is an
owner-created broadcast with a `scheduled_start_at`; `preview` is a session whose
encoder is connected but not yet public; `live` is public; `ended` is finished.

#### Scenario: Draft is created without a datetime

- **WHEN** the owner creates a broadcast with no scheduled datetime
- **THEN** the active row is `status='draft'`, `created_in_ui=true`, and it is
  private (no public viewer or waiting room sees it)

#### Scenario: Scheduled is a dated draft

- **WHEN** the owner creates or edits a broadcast with a scheduled datetime
- **THEN** the active row is `status='scheduled'` with that `scheduled_start_at`,
  `created_in_ui=true`

### Requirement: Single active stream

The system SHALL allow at most one active `streams` row per channel, where active
means `status IN ('draft','scheduled','preview','live')`, enforced by a partial
unique index. Creating or scheduling a broadcast SHALL edit the existing active row
rather than inserting a second; the `/live` page and overlays SHALL always resolve
this single active row.

#### Scenario: Second active stream is rejected

- **WHEN** any code attempts to insert a second active row for a channel that
  already has one
- **THEN** the database rejects it via the partial unique index

#### Scenario: Editing targets the active row

- **WHEN** the owner saves broadcast settings while an active row exists
- **THEN** the existing active row is updated in place, and no new row is created

### Requirement: Public visibility rule

The system SHALL treat a stream as public only when
`(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview')) OR status = 'live'`.
`draft` rows and ad-hoc `preview` rows (created by the encoder, `created_in_ui=false`,
with no datetime) SHALL be private to the owner.

#### Scenario: Dated scheduled is public

- **WHEN** a broadcast has a `scheduled_start_at` and status `scheduled` or `preview`
- **THEN** the public channel treats it as an upcoming/waiting broadcast

#### Scenario: Draft and ad-hoc preview are private

- **WHEN** a broadcast is `draft`, or `preview` with no datetime and `created_in_ui=false`
- **THEN** no public viewer, waiting room, or channel card exposes it

### Requirement: Create then claim

The system SHALL let the owner create the active stream in the UI (`draft` or
`scheduled`), which the encoder later claims on connect by moving it to `preview`
while preserving `scheduled_start_at`, `created_in_ui`, and all configured settings.
When the encoder connects and no active row exists, the system SHALL create one
directly in `preview` with `created_in_ui=false` (ad-hoc).

#### Scenario: Encoder claims a UI-created broadcast

- **WHEN** the encoder connects and the channel has an active `draft` or `scheduled` row
- **THEN** that row becomes `preview` with fresh `started_at`/`hls_path`/`last_seen_at`,
  keeping its datetime, `created_in_ui`, title, description, thumbnail, goals, and
  YouTube video

#### Scenario: Encoder-first creates an ad-hoc preview

- **WHEN** the encoder connects and the channel has no active row
- **THEN** the system inserts a `preview` row with `created_in_ui=false`, private to
  the owner

### Requirement: Go live captures the live marker

The system SHALL allow go-live only from `preview`, setting `status='live'` and
`live_at=now()` and revealing the feed publicly. `live_at` SHALL be the boundary
before which recorded footage is excluded from the VOD.

#### Scenario: Go live from preview

- **WHEN** the owner goes live from a `preview` broadcast
- **THEN** `status` becomes `live`, `live_at` is set to now, and the feed becomes
  public on the channel

#### Scenario: Go live blocked when not previewing

- **WHEN** a go-live is attempted while the active row is `draft`/`scheduled`/`ended`
- **THEN** the system rejects it (no encoder feed to publish)

### Requirement: Discard a pre-live broadcast

The system SHALL let the owner discard the active stream while it is
`draft`, `scheduled`, or `preview`, never creating a VOD. For `draft`/`scheduled`
(no encoder) the row SHALL be deleted, cascading its per-stream data, leaving no
active stream. For `preview` (encoder connected) the row SHALL be reset in place to
a blank private ad-hoc preview: clear `scheduled_start_at`, title, description,
thumbnail, YouTube video, delete its goals and scoring state, set
`created_in_ui=false`, and keep `status='preview'` so the still-connected encoder
does not immediately recreate a stream.

#### Scenario: Discard a draft or scheduled broadcast

- **WHEN** the owner discards while `draft` or `scheduled`
- **THEN** the row and its per-stream data are deleted and no active stream remains

#### Scenario: Discard while previewing keeps a blank preview

- **WHEN** the owner discards while `preview` with the encoder connected
- **THEN** the row is reset to a blank private ad-hoc preview (schedule and settings
  cleared) rather than deleted, because the live encoder would otherwise recreate it

### Requirement: Encoder disconnect handling

On encoder disconnect the system SHALL, for a `preview` row, revert it rather than
end it: to `scheduled` if it has a `scheduled_start_at`, to `draft` if
`created_in_ui=true`, otherwise delete it (ad-hoc). Reverting SHALL clear
`hls_path`, `started_at`, and `live_at`, and SHALL NOT create a VOD. For a `live`
row the system SHALL **never end the broadcast on disconnect**: the row stays
`live`, and the disconnect opens a **reconnect gap** (records the disconnect time)
that a later reconnect closes. Only the owner's End action ends a live broadcast.

#### Scenario: Preview from a scheduled broadcast reverts to scheduled

- **WHEN** the encoder disconnects while `preview` and the row has a `scheduled_start_at`
- **THEN** the row returns to `scheduled` (public waiting room resumes), feed fields
  cleared, and remains reconnectable

#### Scenario: Preview from a draft reverts to draft

- **WHEN** the encoder disconnects while `preview`, `created_in_ui=true`, no datetime
- **THEN** the row returns to `draft` (private), feed fields cleared

#### Scenario: Ad-hoc preview is deleted on disconnect

- **WHEN** the encoder disconnects while `preview` with `created_in_ui=false` and no datetime
- **THEN** the row is deleted, leaving no active stream

#### Scenario: Live disconnect keeps the stream live and opens a gap

- **WHEN** the encoder disconnects while `live`
- **THEN** the row stays `live`, no VOD is finalized, and an open reconnect gap is
  recorded (gap start = the disconnect time)

#### Scenario: Reconnect closes the gap

- **WHEN** the encoder reconnects while the row is still `live` with an open gap
- **THEN** the feed resumes on the same stream id and the open gap is closed
  (gap end = the reconnect time)

### Requirement: End stream requires a disconnected encoder

The system SHALL allow the owner to end a `live` broadcast only when the encoder is
disconnected (the feed is stale beyond the staleness threshold). If the encoder is
still connected, End SHALL be refused with guidance to stop the stream in the encoder
first. Ending SHALL set `status='ended'` and `ended_at`, close any open reconnect
gap, and finalize the VOD (see `vod-recording`). This prevents a still-connected
encoder from immediately recreating an ad-hoc preview after the broadcast ends.

#### Scenario: End refused while the encoder is connected

- **WHEN** the owner presses End stream while the feed is still fresh (encoder connected)
- **THEN** the broadcast is not ended and the owner is told to stop the encoder first

#### Scenario: End after disconnect finalizes the VOD

- **WHEN** the owner presses End stream while the feed is stale (encoder disconnected)
- **THEN** the row becomes `ended` with `ended_at` set, any open gap is closed, and the
  VOD is finalized from the recorded segments since go-live
