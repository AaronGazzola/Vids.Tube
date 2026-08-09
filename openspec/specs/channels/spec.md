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

### Requirement: Channel record

The system SHALL store channels as records with a unique slug, a name, and a description, modeled to support many channels even though v1 has one. A channel SHALL be exactly one of: **claimed** (`owner_user_id` set), **unclaimed** (`owner_user_id` null, `youtube_channel_id` set), or **merged** (`merged_into_channel_id` set). `owner_user_id` SHALL be nullable; `youtube_channel_id` SHALL be a nullable text column unique across channels; `merged_into_channel_id` SHALL be a nullable self-reference to `channels.id`. A check constraint SHALL require at least one of the three identity columns to be non-null.

#### Scenario: Channel has a unique slug

- **WHEN** a channel is created with a slug that already exists
- **THEN** the system rejects the creation because slugs MUST be unique

#### Scenario: Unclaimed channel carries only a YouTube identity

- **WHEN** a channel row is inserted with a null `owner_user_id` and a `youtube_channel_id`
- **THEN** the insert succeeds and the row reads as an unclaimed channel

#### Scenario: YouTube identity is unique

- **WHEN** a channel row is inserted with a `youtube_channel_id` already held by another channel
- **THEN** the database rejects it via the unique constraint

#### Scenario: Identity-less channel is rejected

- **WHEN** a channel row is inserted with `owner_user_id`, `youtube_channel_id`, and `merged_into_channel_id` all null
- **THEN** the database rejects it via the check constraint

### Requirement: Public channel readability

The system SHALL allow anyone, including anonymous visitors, to read channel
records.

#### Scenario: Anonymous read

- **WHEN** an anonymous visitor requests channel data
- **THEN** the system returns the channel record without requiring authentication

### Requirement: Owner-only channel mutation

The system SHALL allow a user to create, update, or delete only channels they
own.

#### Scenario: User creates their own channel

- **WHEN** an authenticated user inserts a channel with their own user id as owner
- **THEN** the system allows the insert

#### Scenario: User cannot create a channel owned by someone else

- **WHEN** an authenticated user inserts a channel whose owner id is a different
  user
- **THEN** the system rejects the insert

#### Scenario: User cannot modify another user's channel

- **WHEN** an authenticated user attempts to update or delete a channel they do
  not own
- **THEN** the system rejects the operation

### Requirement: Public channel page

The system SHALL render a public page for a channel addressed by its slug. The
page shell SHALL render immediately, with the data-dependent channel content
fetched via a React Query hook and shown with inline loading skeletons while
loading.

#### Scenario: Existing channel renders

- **WHEN** a visitor opens the page for an existing channel slug
- **THEN** the system displays the channel name and description after the channel
  query resolves

#### Scenario: Loading state

- **WHEN** the channel query is in flight
- **THEN** the page shell is visible and the channel name/description areas show
  inline loading skeletons

#### Scenario: Unknown channel shows a not-found state

- **WHEN** a visitor opens the page for a slug that has no channel
- **THEN** the channel query returns no row and the page displays a not-found
  state

### Requirement: One channel per user

The system SHALL allow each user to own at most one channel. The data model SHALL enforce this with a uniqueness constraint on the channel's `owner_user_id`.

#### Scenario: User creates their first channel

- **WHEN** an authenticated user with no existing channel creates a channel
- **THEN** the channel is created with `owner_user_id` set to that user

#### Scenario: User cannot own a second channel

- **WHEN** an authenticated user who already owns a channel attempts to create another
- **THEN** the system rejects the creation and the user still owns exactly one channel

### Requirement: Channel handle

A channel SHALL carry a unique, case-insensitive `@handle`. The handle SHALL match the format `^[a-z0-9_]{3,30}$`, SHALL be stored normalized to lowercase, and SHALL be unique across all channels regardless of case. The channel's route `slug` SHALL equal its handle.

#### Scenario: Handle is normalized and stored

- **WHEN** a user claims a handle containing uppercase letters
- **THEN** the stored handle is the lowercased form and the channel `slug` equals that handle

#### Scenario: Handle uniqueness is case-insensitive

- **WHEN** a user attempts to claim a handle that differs from an existing handle only by letter case
- **THEN** the system rejects it as already taken

#### Scenario: Handle format is enforced

- **WHEN** a user submits a handle shorter than 3 characters, longer than 30, or containing characters outside `a-z`, `0-9`, `_`
- **THEN** the system rejects it with a validation message and no channel field is changed

#### Scenario: Reserved handle is rejected

- **WHEN** a user submits a handle that matches a reserved word (e.g. `admin`, `studio`, `account`, `onboarding`)
- **THEN** the system rejects it with a message that the handle is unavailable

### Requirement: Publishing and public channel viewing gated to the platform owner

The system SHALL treat the owner of the earliest-created channel as the platform owner. Only the platform owner SHALL be able to publish live/VOD content. Channel **viewing** SHALL be public for every channel: any visitor, anonymous or signed-in, SHALL be able to view any account (owned, non-tombstone) channel's normal channel/profile page and any unclaimed channel's stats-only profile. A merged (tombstone) channel SHALL redirect to its survivor. Publishing and branding-upload affordances SHALL render only for the channel's own owner.

#### Scenario: Non-owner cannot access publishing

- **WHEN** a signed-in user who is not the platform owner navigates to the studio/publishing area
- **THEN** the system redirects them away and exposes no publishing controls

#### Scenario: Owner channel page is public

- **WHEN** any visitor opens the platform owner's channel page
- **THEN** the page renders publicly

#### Scenario: Any account channel is publicly viewable

- **WHEN** any visitor opens any owned, non-tombstone channel page
- **THEN** the channel's normal profile/channel page renders regardless of who owns it

#### Scenario: Unclaimed channel is public

- **WHEN** any visitor opens an unclaimed channel's page
- **THEN** the stats-only profile renders with a claim call to action

#### Scenario: Merged channel redirects

- **WHEN** a visitor opens a channel whose `merged_into_channel_id` is set
- **THEN** they are redirected to the surviving channel

#### Scenario: Publishing controls are owner-only

- **WHEN** a visitor who does not own the channel views it
- **THEN** no publishing or branding-upload affordances render

### Requirement: Channel rows remain readable for identity resolution

The system SHALL keep channel rows readable so that a user's handle, name, and avatar can be resolved from their `owner_user_id`. Read access to channel rows SHALL NOT be restricted by the publishing/page-viewing gate.

#### Scenario: Resolve author identity from user id

- **WHEN** the system looks up the channel whose `owner_user_id` equals a given user id
- **THEN** it can read that channel's handle, name, and avatar regardless of whether that channel is publicly browsable

### Requirement: Merged channels redirect to their survivor

A merged channel SHALL keep its handle (reserving it) and its page route SHALL redirect to the surviving channel's page. Channel resolution by slug SHALL follow `merged_into_channel_id` before rendering.

#### Scenario: Visiting a merged channel's URL

- **WHEN** a visitor opens the page for a handle whose channel has `merged_into_channel_id` set
- **THEN** the visitor is redirected to the surviving channel's page

### Requirement: Ownerless channels are read-only to clients

Existing owner-scoped mutation policies SHALL continue to apply unchanged: because unclaimed and merged channels have no owner, no client role can update or delete them; they are created and modified exclusively via the service role.

#### Scenario: Client cannot mutate an unclaimed channel

- **WHEN** an authenticated user attempts to update or delete an unclaimed channel
- **THEN** row-level security rejects the operation

### Requirement: Channels can be marked as software

The system SHALL store an `is_software` boolean on `channels`, defaulting to false, set only by the service role. The marker SHALL be explicit per channel and SHALL NEVER be inferred from a channel's name or handle, because a real viewer's display name may contain the word "bot".

#### Scenario: The marker is explicit

- **WHEN** a channel whose display name contains "bot" belongs to a real viewer
- **THEN** that channel is not marked as software and is treated as a member

#### Scenario: Clients cannot set the marker

- **WHEN** a client attempts to set `is_software`
- **THEN** the write is denied by row-level security

### Requirement: A channel that has never published shows no videos section

A channel page SHALL omit the videos section entirely when the channel has no published videos, rather than showing the section with an empty state. The channel's own owner SHALL continue to see the section whether or not it is empty, so it stays clear where their uploads will appear.

This matters now that a chatter's channel page is a destination: a greeted chatter arriving at their own profile should not be shown an empty shelf for a feature they cannot use.

#### Scenario: A chatter's page has no videos section

- **WHEN** a visitor opens the page of a channel that has published nothing
- **THEN** no videos heading and no empty-state message render

#### Scenario: The owner still sees where uploads land

- **WHEN** a channel's own owner opens their page and has published nothing
- **THEN** the videos section renders with its empty state

#### Scenario: A published channel is unaffected

- **WHEN** a visitor opens a channel that has published videos
- **THEN** the videos section renders as before

