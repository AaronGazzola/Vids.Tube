## ADDED Requirements

### Requirement: Competition leaderboard rows carry the sound button

Each entry on the control room's competition leaderboard SHALL carry the same
owner-only sound button, opening the same dialog, as the member rows in a
channel's community section.

The control room is already owner-only, so the button SHALL render on every
entry there.

#### Scenario: The owner opens the sound dialog from the leaderboard

- **WHEN** the owner activates the sound button on a leaderboard entry
- **THEN** the sound dialog for that member opens, offering the same upload, playback, approval and mute controls as on the channel page

#### Scenario: A pending upload is visible on the leaderboard

- **WHEN** a member on the leaderboard has a sound awaiting approval
- **THEN** that entry's sound button is styled distinctly from the rest
