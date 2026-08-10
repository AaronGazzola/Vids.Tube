## ADDED Requirements

### Requirement: A going-live broadcast records the master playlist as its address

The system SHALL record the channel's master playlist address as the broadcast's playback
address when an encoder connects, so that viewers are handed every rendition rather than
one. Addresses already recorded on earlier broadcasts SHALL continue to resolve.

#### Scenario: A new broadcast records the master playlist

- **WHEN** an encoder connects and the broadcast's playback address is recorded
- **THEN** the recorded address is the channel's master playlist

#### Scenario: An earlier broadcast keeps playing

- **WHEN** a broadcast recorded before this change is played back from its stored address
- **THEN** the stored single-rendition address still resolves and plays

#### Scenario: Transcription is unaffected

- **WHEN** the local worker pulls audio for live transcription
- **THEN** it pulls the publisher's own rendition, built from its own configuration, and
  is unaffected by the master playlist
