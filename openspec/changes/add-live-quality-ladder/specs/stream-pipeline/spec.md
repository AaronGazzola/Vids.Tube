## ADDED Requirements

### Requirement: A going-live broadcast records the master playlist when the machine reports a ladder

The system SHALL record the channel's master playlist address as the broadcast's playback
address when, and only when, the streaming machine reports that a ladder is being produced
for the connecting broadcast. Otherwise the single-rendition address SHALL be recorded, as
it is today. Addresses already recorded on earlier broadcasts SHALL continue to resolve.

#### Scenario: The machine reports a ladder

- **WHEN** an encoder connects and the live hook reports a ladder
- **THEN** the recorded playback address is the channel's master playlist

#### Scenario: The machine reports no ladder

- **WHEN** an encoder connects and the live hook does not report a ladder
- **THEN** the recorded playback address is the channel's single-rendition address

#### Scenario: A reconnect follows the machine's current answer

- **WHEN** an encoder reconnects to a broadcast already in progress
- **THEN** the recorded playback address is updated to match what the live hook reports at
  that moment

#### Scenario: An earlier broadcast keeps playing

- **WHEN** a broadcast recorded before this change is played back from its stored address
- **THEN** the stored single-rendition address still resolves and plays

#### Scenario: Transcription is unaffected

- **WHEN** the local worker pulls audio for live transcription
- **THEN** it pulls the publisher's own rendition, built from its own configuration, and is
  unaffected by the master playlist
