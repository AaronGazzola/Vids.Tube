## MODIFIED Requirements

### Requirement: Create a scheduled broadcast ahead of time

The system SHALL let the channel owner create/configure the single active broadcast
before any encoder connects, capturing an optional title, description, thumbnail,
overlay settings, and an optional `scheduled_start_at`. With a datetime the row is
`status='scheduled'` (public waiting room); without a datetime it is `status='draft'`
(private). Both are created with `created_in_ui=true`. Because at most one active
stream may exist, saving SHALL edit the existing active row when one exists rather
than creating a second. A non-empty title is NOT required to create/save; it is
required only to go live (see `broadcast-setup`).

#### Scenario: Owner creates a private draft

- **WHEN** the owner saves broadcast settings with no scheduled datetime and no
  active stream exists
- **THEN** the system stores a `streams` row with `status='draft'`, `created_in_ui=true`,
  private to the owner

#### Scenario: Owner schedules a dated broadcast

- **WHEN** the owner saves broadcast settings with a scheduled datetime
- **THEN** the active row is `status='scheduled'` with that `scheduled_start_at`,
  public as a waiting room/coming-soon card

#### Scenario: Saving edits the existing active row

- **WHEN** the owner saves settings while an active `draft`/`scheduled`/`preview`/`live`
  row exists
- **THEN** the existing active row is updated in place; no second active row is created

#### Scenario: Only the owner can create

- **WHEN** an anonymous or non-owner user attempts to create/edit the broadcast
- **THEN** the system rejects the request and creates no row

### Requirement: Cancel a scheduled broadcast

The system SHALL let the owner discard the active pre-live broadcast
(`draft`/`scheduled`/`preview`), which supersedes the prior cancel action. For
`draft`/`scheduled` (no encoder) the row SHALL be deleted, removing it from the
upcoming/coming-soon surfaces so it can never be claimed. For `preview` (encoder
connected) the row SHALL be reset in place to a blank private ad-hoc preview (see
`stream-lifecycle` Discard). Discard SHALL never create a VOD.

#### Scenario: Owner discards an upcoming broadcast

- **WHEN** the owner discards a `draft` or `scheduled` broadcast
- **THEN** the row and its per-stream data are deleted, it no longer renders as a
  coming-soon card, and a subsequent encoder connect does not claim it

#### Scenario: Owner discards while previewing

- **WHEN** the owner discards while `preview`
- **THEN** the row is reset to a blank private ad-hoc preview instead of deleted, and
  no VOD is created
