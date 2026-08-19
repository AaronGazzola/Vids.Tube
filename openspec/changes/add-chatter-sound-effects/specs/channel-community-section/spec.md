## ADDED Requirements

### Requirement: Owner-only sound button on community member rows

Each member row in a channel's community section SHALL carry a sound button that
opens the sound dialog for that member. The button SHALL render only for the
signed-in owner of that community, and SHALL NOT render for any other visitor.

The button SHALL be styled distinctly where that member has a sound awaiting the
owner's approval, so a pending upload is visible without opening any row.

#### Scenario: The owner sees the sound buttons

- **WHEN** the owner of a community opens their channel page
- **THEN** every member row in the community section carries a sound button

#### Scenario: A visitor sees no sound buttons

- **WHEN** any visitor who does not own the community opens the same page
- **THEN** no member row carries a sound button

#### Scenario: A pending upload is visible from the row

- **WHEN** a member has uploaded a sound that is awaiting approval
- **THEN** that member's sound button is styled distinctly from the rest

### Requirement: One dialog uploads, plays, approves and mutes

The sound button SHALL open a single dialog that lets the owner upload a sound
for that member, play whichever sound currently resolves for that member, and
mute or unmute that member.

Where that member has a sound awaiting approval, the dialog SHALL additionally
offer playback of the pending sound with approve and reject.

The dialog SHALL state which sound currently resolves, so the owner can see when
their own upload is outranked by the member's.

#### Scenario: The owner uploads for a member

- **WHEN** the owner chooses an audio file of at most 3 seconds in the dialog
- **THEN** that sound is stored as the owner's sound for that member and needs no approval

#### Scenario: The owner approves a member's sound

- **WHEN** the owner approves a pending sound in the dialog
- **THEN** that member's own sound resolves from then on, outranking any sound the owner uploaded for that member

#### Scenario: The dialog explains an outranked owner upload

- **WHEN** the owner opens the dialog for a member whose own sound is approved and for whom the owner has also uploaded a sound
- **THEN** the dialog states that the member's own sound is what plays
