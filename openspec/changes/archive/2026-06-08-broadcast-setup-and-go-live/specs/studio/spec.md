## REMOVED Requirements

### Requirement: Go Live tool (placeholder)

**Reason**: Replaced by the real preview→Go-live control surface delivered in this change.
**Migration**: Superseded by the "Go Live tool" requirement below.

## ADDED Requirements

### Requirement: Go Live tool

The system SHALL provide a working go-live control surface at `/studio/live` that
reflects the broadcast's current state: stream connection details when idle, a
preview-and-setup experience while in `preview`, and a live-management experience
while `live`.

#### Scenario: Idle — connection details

- **WHEN** the owner opens `/studio/live` and no broadcast is connected
- **THEN** the page shows the RTMP server URL and stream key (with regenerate) so
  the owner can configure their encoder

#### Scenario: Preview — set up and go live

- **WHEN** the owner opens `/studio/live` while a broadcast is in `preview`
- **THEN** the page shows a self-preview player, a setup form for title
  (required), description, and thumbnail, and a Go live control that is disabled
  until a non-empty title is set

#### Scenario: Live — manage the broadcast

- **WHEN** the owner opens `/studio/live` while the broadcast is `live`
- **THEN** the page shows a live indicator and an End control to stop the
  broadcast (live viewer count is tracked separately under analytics, AZ-26)
