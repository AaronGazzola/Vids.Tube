## ADDED Requirements

### Requirement: Preview gate before going public

The system SHALL NOT make a broadcast public automatically when the encoder
connects. While the encoder is connected but the owner has not yet gone live,
the broadcast SHALL be in a private `preview` state: viewable only by the
channel owner (for self-preview in Studio) and never rendered to viewers.

#### Scenario: Encoder connect lands in preview

- **WHEN** the owner's encoder connects and the ingest ready hook fires
- **THEN** the broadcast is in `preview` state, the owner can see a self-preview
  in Studio, and no public viewer sees the stream

#### Scenario: Preview is owner-only

- **WHEN** a broadcast is in `preview`
- **THEN** only the channel owner can load its preview playback; a non-owner
  read of the channel's live state returns not-live

### Requirement: Title-required go-live

The system SHALL let the channel owner promote a `preview` broadcast to public
`live` only through an explicit owner action, and SHALL reject that action
unless the broadcast has a non-empty title.

#### Scenario: Go live with a title

- **WHEN** the owner sets a non-empty title and triggers Go live on a `preview`
  broadcast
- **THEN** the broadcast becomes public `live` and viewers can now watch it
  (its `started_at`, set at encoder-connect/recording start, is left unchanged so
  VOD chat replay stays aligned with the recording)

#### Scenario: Go live blocked without a title

- **WHEN** the owner triggers Go live on a `preview` broadcast that has no title
- **THEN** the system does not make it public and returns a user-facing error
  indicating a title is required

#### Scenario: Only the owner can go live

- **WHEN** a non-owner attempts the Go live action
- **THEN** the system rejects it and the broadcast stays in `preview`

### Requirement: Broadcast metadata authoring

The system SHALL allow the channel owner to set a broadcast's title,
description, and thumbnail while it is in `preview`, and these values SHALL
persist on the `streams` row.

#### Scenario: Owner edits broadcast metadata

- **WHEN** the owner edits the title, description, or thumbnail of a `preview`
  broadcast
- **THEN** the system stores the values on that broadcast and reflects them in
  the setup form

### Requirement: Custom thumbnail upload

The system SHALL let the owner upload a custom thumbnail image for a broadcast.
The image SHALL be stored in the VOD object store (R2/CDN) so its URL resolves
through the same path as VOD media, and the stored key SHALL be recorded as the
broadcast's `thumbnail_path`.

#### Scenario: Owner uploads a thumbnail

- **WHEN** the owner uploads an image as the broadcast thumbnail
- **THEN** the system stores it in the VOD object store and sets the broadcast's
  `thumbnail_path` to its key, and the thumbnail renders from the CDN

#### Scenario: Custom thumbnail overrides the auto-extracted one

- **WHEN** a broadcast with an owner-set `thumbnail_path` finishes and its VOD is
  finalized
- **THEN** the VOD keeps the owner's custom thumbnail rather than the
  machine-extracted thumbnail

### Requirement: End broadcast

The system SHALL let the owner end a live broadcast through an explicit owner
action that sets the broadcast to `ended`.

#### Scenario: Owner ends the broadcast

- **WHEN** the owner triggers End on a `live` broadcast
- **THEN** the broadcast becomes `ended` and stops being shown as live
