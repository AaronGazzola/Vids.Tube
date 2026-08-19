## ADDED Requirements

### Requirement: A member holds one sound per community

The system SHALL hold at most one sound record per member per community. The
record SHALL carry the member's own uploaded sound and its approval state, the
owner's uploaded sound for that member, and a mute flag, so that a member's
sound and the owner's sound for that member coexist without either overwriting
the other.

The record SHALL be keyed on the member's identity channel and the community
channel, never on a chat participant key, so that linking a YouTube identity to
a site account does not orphan the record.

#### Scenario: Both a member sound and an owner sound are held

- **WHEN** the owner has uploaded a sound for a member and that member later
  uploads one of their own
- **THEN** both sounds are held on the same record and neither upload has
  replaced the other

#### Scenario: A member with no sound anywhere

- **WHEN** a member has never uploaded a sound and the owner has never uploaded
  one for that member
- **THEN** no sound record is required for that member and the default bell is
  what plays

### Requirement: A member uploads a sound of their own, bounded to three seconds

The system SHALL let a signed-in member upload an audio file as their sound for
a community they are a member of.

Before any bytes are sent, the browser SHALL decode the chosen file and refuse
one longer than 3 seconds, naming the measured length in the refusal, so an
over-length sound is never stored.

The storage bucket SHALL independently declare a maximum file size and an
allowlist of audio content types, so an upload that bypasses the browser check
is still refused by storage.

A member uploading again SHALL replace their previous sound on the same record,
and the replacement SHALL return to awaiting approval.

#### Scenario: An over-length file is refused before upload

- **WHEN** a member chooses a file measured at more than 3 seconds
- **THEN** the upload is refused with the measured length shown, and nothing is
  written to storage

#### Scenario: A file of a disallowed type is refused by storage

- **WHEN** an upload of a content type outside the allowlist reaches storage
- **THEN** storage rejects it and no sound record is written

#### Scenario: Re-uploading returns to awaiting approval

- **WHEN** a member whose sound was already approved uploads a replacement
- **THEN** the replacement awaits approval and the previous sound no longer
  plays

### Requirement: A member's own sound plays only once the owner approves it

A sound uploaded by a member SHALL NOT play on the overlay until the community's
owner approves it. The owner SHALL be able to hear the sound before deciding.

The owner SHALL be able to reject a member's sound, after which that sound does
not play and the member may upload another.

#### Scenario: An unapproved sound never reaches the overlay

- **WHEN** a member's uploaded sound is awaiting approval and that member's
  message is highlighted
- **THEN** the moment is announced by whatever the resolution order yields
  excluding the unapproved sound

#### Scenario: The owner hears a sound before approving it

- **WHEN** the owner opens the sound dialog for a member with a sound awaiting
  approval
- **THEN** the dialog offers playback of that sound alongside approve and reject

### Requirement: The owner uploads a sound for a member without approval

The system SHALL let the community's owner upload a sound for any member of that
community. An owner upload SHALL be subject to the same 3 second and content
type bounds as a member upload, and SHALL require no approval, because the owner
is the approver.

#### Scenario: An owner upload plays immediately

- **WHEN** the owner uploads a sound for a member who has no approved sound of
  their own
- **THEN** that sound announces that member's next overlay moment without any
  approval step

### Requirement: A member's approved sound outranks the owner's upload

The system SHALL resolve a member's sound in this order: the member's own
approved sound, then the owner's uploaded sound for that member, then the
default bell.

Once a member's own sound is approved it SHALL take precedence permanently, and
a later owner upload SHALL NOT displace it.

#### Scenario: A member's approval displaces the owner's upload

- **WHEN** the owner has uploaded a sound for a member and that member's own
  sound is then approved
- **THEN** the member's own sound announces that member's moments from then on

#### Scenario: The owner cannot re-take precedence by uploading again

- **WHEN** the owner uploads another sound for a member whose own sound is
  approved
- **THEN** the member's own sound still announces that member's moments

### Requirement: Muting falls back to the default, never to the owner's upload

The system SHALL let the owner mute a member's sound. A muted member's moments
SHALL be announced by the default bell, and SHALL NOT be announced by the
owner's uploaded sound for that member.

Muting SHALL NOT delete or reject either upload, so unmuting restores the same
resolution as before.

#### Scenario: Muting a member with both sounds present

- **WHEN** the owner mutes a member whose own sound is approved and for whom the
  owner has also uploaded a sound
- **THEN** that member's moments are announced by the default bell

#### Scenario: Unmuting restores the previous sound

- **WHEN** the owner unmutes a member whose own sound was approved before muting
- **THEN** that member's own sound announces that member's moments again

### Requirement: Playback is bounded at three seconds

The overlay SHALL stop a sound after 3 seconds however long the stored file
runs, so a sound that evaded the upload bound cannot hold a broadcast.

The shared player SHALL report completion when the sound ends or when the bound
fires, whichever comes first, so a moment that waits on the sound is never left
waiting.

#### Scenario: A longer stored file is cut

- **WHEN** a stored sound runs longer than 3 seconds
- **THEN** playback stops at 3 seconds and whatever waited on the sound proceeds

#### Scenario: A sound that fails to load does not stall the moment

- **WHEN** a resolved sound cannot be loaded
- **THEN** the moment proceeds as though the sound had finished
