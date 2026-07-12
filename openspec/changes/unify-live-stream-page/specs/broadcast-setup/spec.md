## ADDED Requirements

### Requirement: Discard from the status toolbar

The system SHALL provide a Discard action in the `/live` status toolbar, available
while the active stream is `draft`, `scheduled`, or `preview`, applying the discard
behaviour defined by `stream-lifecycle` (delete a `draft`/`scheduled`; reset a
`preview` to a blank private ad-hoc preview). Discard SHALL never create a VOD and
SHALL require a confirmation dialog.

#### Scenario: Discard a scheduled broadcast

- **WHEN** the owner confirms Discard while `scheduled`
- **THEN** the broadcast is deleted, no VOD is created, and no active stream remains

#### Scenario: Discard is unavailable when live

- **WHEN** the stream is `live`
- **THEN** the toolbar offers End stream (which creates the VOD), not Discard

### Requirement: Confirmation dialogs for go-live, end, and discard

The system SHALL require a confirmation dialog before Go live, End stream, and
Discard. The Discard-while-`preview` confirmation SHALL explain that, because the
encoder is still connected, a blank private preview will remain and the encoder must
be stopped to fully clear.

#### Scenario: Confirm before going live

- **WHEN** the owner presses Go live
- **THEN** a confirmation dialog is shown and the stream goes public only on confirm

#### Scenario: Confirm before ending

- **WHEN** the owner presses End stream
- **THEN** a confirmation dialog is shown and the broadcast ends (creating the VOD)
  only on confirm

#### Scenario: Discard-in-preview wording

- **WHEN** the owner presses Discard while `preview`
- **THEN** the confirmation explains a blank private preview will remain and the
  encoder must be stopped to fully clear
