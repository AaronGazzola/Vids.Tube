# channels Specification

## Purpose
TBD - created by archiving change add-channel-branding. Update Purpose after archive.
## Requirements
### Requirement: Channel branding fields

A channel record SHALL carry optional avatar and banner asset references as
nullable `avatar_path` and `banner_path` text columns. Both fields SHALL be
null by default and remain null until the channel owner uploads an asset.

#### Scenario: Newly created channel has no branding

- **WHEN** a channel record is inserted
- **THEN** `avatar_path` and `banner_path` are null

#### Scenario: Channel branding fields are independently nullable

- **WHEN** a channel has only an avatar uploaded
- **THEN** `avatar_path` is non-null and `banner_path` remains null (and vice
  versa); each asset can be set or unset independently

### Requirement: Owner-only channel branding upload

The system SHALL allow only the authenticated owner of a channel to upload that
channel's avatar or banner. Any other authenticated user, and any anonymous
visitor, SHALL be prevented from writing to that channel's branding storage
path.

#### Scenario: Owner uploads their own channel avatar

- **WHEN** the authenticated owner uploads an image to the avatar slot of their
  channel
- **THEN** the system stores the object under
  `channel-assets/<channel_id>/avatar-<unix_ms>.<ext>`, updates the channel's
  `avatar_path` to that key, and best-effort deletes the previously-pointed-at
  avatar object if one existed

#### Scenario: Owner uploads their own channel banner

- **WHEN** the authenticated owner uploads an image to the banner slot of their
  channel
- **THEN** the system stores the object under
  `channel-assets/<channel_id>/banner-<unix_ms>.<ext>`, updates the channel's
  `banner_path` to that key, and best-effort deletes the previously-pointed-at
  banner object if one existed

#### Scenario: Non-owner cannot upload branding

- **WHEN** an authenticated user who does not own a channel attempts to upload
  an image to that channel's storage path
- **THEN** the storage RLS policy rejects the write

#### Scenario: Anonymous visitor cannot upload branding

- **WHEN** an anonymous (unauthenticated) request attempts to upload to the
  branding storage path of any channel
- **THEN** the storage RLS policy rejects the write

#### Scenario: Upload rejects a non-image file

- **WHEN** the owner submits a file whose MIME type is not in the allowlist
  (`image/jpeg`, `image/png`, `image/webp`)
- **THEN** the upload action rejects the request and the channel record is not
  modified

#### Scenario: Upload rejects an oversized file

- **WHEN** the owner submits an avatar file larger than 2 MB, or a banner file
  larger than 5 MB
- **THEN** the upload action rejects the request and the channel record is not
  modified

### Requirement: Public read of channel branding assets

The system SHALL allow anyone, including anonymous visitors, to fetch an
uploaded branding asset via the public storage URL.

#### Scenario: Anonymous viewer loads a channel's avatar and banner

- **WHEN** an anonymous viewer requests the public storage URL for a channel's
  `avatar_path` or `banner_path`
- **THEN** the system serves the image with a 200 response

### Requirement: Channel page renders uploaded branding with fallbacks

The public channel page SHALL render the uploaded avatar and banner when set,
and SHALL render the existing default placeholders (gradient banner and
initials avatar) when either field is null.

#### Scenario: Channel with both assets uploaded

- **WHEN** a visitor opens a channel page whose `avatar_path` and `banner_path`
  are both non-null
- **THEN** the page renders the avatar and banner from
  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel-assets/<path>`

#### Scenario: Channel with no banner uploaded

- **WHEN** a visitor opens a channel page whose `banner_path` is null
- **THEN** the page renders the gradient banner placeholder

#### Scenario: Channel with no avatar uploaded

- **WHEN** a visitor opens a channel page whose `avatar_path` is null
- **THEN** the page renders the initials avatar fallback derived from the
  channel name

### Requirement: Upload affordances visible only to the channel owner

The system SHALL render upload-icon buttons over the avatar and banner only
when the signed-in user owns the channel being viewed. Non-owners and
anonymous visitors SHALL NOT see any upload affordance.

#### Scenario: Owner views their own channel

- **WHEN** the signed-in user is the owner of the channel being viewed
- **THEN** the page renders an upload-icon button at the bottom-right of the
  banner and another at the bottom-right of the avatar

#### Scenario: Non-owner views a channel

- **WHEN** a signed-in user who does not own the channel views it
- **THEN** the page renders no upload affordances

#### Scenario: Anonymous visitor views a channel

- **WHEN** an unauthenticated visitor views a channel
- **THEN** the page renders no upload affordances

### Requirement: Owner upload flow via dialog with image dropzone

The upload affordance SHALL open a dialog containing a dropzone that accepts
an image via drag-and-drop or a file picker, uploads it on receipt, and closes
the dialog on success.

#### Scenario: Owner drops an image onto the dropzone

- **WHEN** the owner drops a single image file (matching an allowed MIME type)
  onto the dropzone
- **THEN** the system uploads the file, updates the corresponding `*_path`
  column, closes the dialog, surfaces a success toast, and the rendered image
  on the channel page swaps to the new asset without a full page reload

#### Scenario: Owner picks an image via the file picker

- **WHEN** the owner clicks the dropzone (or its Browse control) and selects an
  image file
- **THEN** the system performs the same upload + update flow as for a drop

#### Scenario: Upload error keeps the dialog open

- **WHEN** the upload action throws (e.g. validation failure, network error)
- **THEN** the dialog remains open, an error toast is shown, and the user may
  retry without reopening the dialog

