## MODIFIED Requirements

### Requirement: Custom thumbnail upload

The system SHALL let the owner upload a custom thumbnail image for a broadcast.
The image SHALL be stored in the VOD object store (R2/CDN) so its URL resolves
through the same path as VOD media, and the stored key SHALL be recorded as the
broadcast's `thumbnail_path`.

Choosing a thumbnail SHALL NOT require a connected encoder, and SHALL NOT be gated on the
broadcast's status. Choosing one SHALL stage it in the settings form and show it immediately,
writing nothing; the upload and the `thumbnail_path` write SHALL happen when the owner saves
the settings, alongside every other field. Abandoning a selection SHALL leave nothing in
storage.

#### Scenario: Owner uploads a thumbnail

- **WHEN** the owner chooses an image as the broadcast thumbnail and saves the settings
- **THEN** the system stores it in the VOD object store and sets the broadcast's
  `thumbnail_path` to its key, and the thumbnail renders from the CDN

#### Scenario: Choosing a thumbnail without an encoder

- **WHEN** the owner chooses a thumbnail with no encoder connected and no broadcast live
- **THEN** the chosen image is shown in the settings form and can be saved

#### Scenario: Choosing a thumbnail keeps other unsaved edits

- **WHEN** the owner edits the title, then chooses a thumbnail
- **THEN** the edited title is still in the form, because choosing a thumbnail writes nothing
  and triggers no resync

#### Scenario: Abandoning a chosen thumbnail stores nothing

- **WHEN** the owner chooses a thumbnail and reloads without saving
- **THEN** no object was uploaded and the broadcast's `thumbnail_path` is unchanged

#### Scenario: Custom thumbnail overrides the auto-extracted one

- **WHEN** a broadcast with an owner-set `thumbnail_path` finishes and its VOD is
  finalized
- **THEN** the VOD keeps the owner's custom thumbnail rather than the
  machine-extracted thumbnail
