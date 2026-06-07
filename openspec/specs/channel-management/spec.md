# channel-management Specification

## Purpose
TBD - created by archiving change user-channel-scaffold. Update Purpose after archive.
## Requirements
### Requirement: Owner edits their channel identity

The system SHALL let the signed-in owner of a channel edit that channel's name, handle, and description through a management UI, persisting changes to the channel record. Editing the handle SHALL also update the channel's `slug` to match. The management UI SHALL replace the previously stubbed Account and Studio Settings screens.

#### Scenario: Owner updates name and description

- **WHEN** the owner changes their channel name and description and saves
- **THEN** the channel record is updated and the new values are reflected in the UI

#### Scenario: Owner updates handle

- **WHEN** the owner changes their handle to an available, well-formed handle and saves
- **THEN** the channel's handle and slug are both updated to the new value

#### Scenario: Owner submits an invalid or taken handle

- **WHEN** the owner saves a handle that is malformed, reserved, or already used by another channel
- **THEN** the system rejects the change with a clear message and leaves the channel unchanged

### Requirement: Only the channel owner can edit it

The system SHALL allow only the authenticated owner of a channel to modify that channel's fields. Any other user SHALL be prevented from editing it, enforced at the data layer (RLS) and reflected in the UI.

#### Scenario: Non-owner cannot edit a channel

- **WHEN** an authenticated user who does not own a channel attempts to update its fields
- **THEN** the system rejects the update and the channel is unchanged

#### Scenario: Management UI shows only the user's own channel

- **WHEN** a signed-in user opens the channel management UI
- **THEN** it loads and edits only their own channel

### Requirement: Owner manages channel avatar and banner from the management UI

The system SHALL let the owner set the channel avatar and banner from the management UI, reusing the existing branding upload dialog and owner-gated upload flow.

#### Scenario: Owner uploads avatar from management UI

- **WHEN** the owner uploads an avatar image from the management UI
- **THEN** the channel's avatar is updated using the existing branding upload flow and the new image is shown

#### Scenario: Owner uploads banner from management UI

- **WHEN** the owner uploads a banner image from the management UI
- **THEN** the channel's banner is updated using the existing branding upload flow and the new image is shown

