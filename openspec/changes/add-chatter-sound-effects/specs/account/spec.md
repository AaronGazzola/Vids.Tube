## ADDED Requirements

### Requirement: A member manages their overlay sound from the account page

The account page SHALL let a signed-in member upload the sound that announces
their moments on a community's overlay, and SHALL show the current state of that
sound: none uploaded, awaiting the owner's approval, approved, rejected, or
muted by the owner.

Where the member belongs to more than one community, the page SHALL show the
sound per community, because a sound is held per community.

The page SHALL let the member play back their own uploaded sound whatever its
state, so a member can hear what is awaiting approval.

#### Scenario: A member uploads a sound

- **WHEN** a signed-in member chooses an audio file of at most 3 seconds on the account page
- **THEN** the sound is stored against that member and shown as awaiting the owner's approval

#### Scenario: A member sees that the owner muted their sound

- **WHEN** the owner has muted a member's approved sound
- **THEN** the account page shows that sound as muted rather than as approved

#### Scenario: A member with no membership

- **WHEN** a signed-in user who is not a member of any community opens the account page
- **THEN** no sound upload is offered, because a sound is held per community
