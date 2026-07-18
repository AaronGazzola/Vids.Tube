## ADDED Requirements

### Requirement: Moderated TTS request lifecycle

The system SHALL accept `!tts <message>` (200-char argument limit, 180s per-user
cooldown, 5 per user per stream) and SHALL run every request through an AI
moderation verdict before anything is spoken. Failing requests SHALL be recorded
as `dismissed` with the reason and produce no reply. Passing requests SHALL
become `approved` when `tts_mode` is `auto`, or `suggested` when it is
`suggest`, and the requester SHALL receive an ack reply saying it is queued or
awaiting approval. Auto mode SHALL never bypass moderation — it only skips the
owner's click for passing requests.

#### Scenario: Passing request in suggest mode

- **WHEN** a viewer sends a clean `!tts` message while `tts_mode` is `suggest`
- **THEN** a `suggested` row is created with the moderation reasoning and the
  viewer is told it awaits approval

#### Scenario: Passing request in auto mode

- **WHEN** a viewer sends a clean `!tts` message while `tts_mode` is `auto`
- **THEN** the row is `approved` immediately and the viewer is told it is queued

#### Scenario: Failing request

- **WHEN** the moderation verdict rejects the message
- **THEN** the row is `dismissed` with the reason, nothing is synthesized, and
  no reply is sent

#### Scenario: Over-length request

- **WHEN** the `!tts` argument exceeds 200 characters
- **THEN** no row is created and the reply explains the limit

### Requirement: Owner TTS panel

The system SHALL provide a TTS panel in the /live Activity tab mirroring the
mod-bot pattern: suggested requests with their text and moderation reasoning and
Approve/Dismiss controls; approving flips the row to `approved` (picked up for
synthesis), dismissing to `dismissed`. The Settings tab SHALL provide an
"Auto-TTS (vs suggest)" switch persisted with the one-save form.

#### Scenario: Approve a suggestion

- **WHEN** the owner approves a suggested request
- **THEN** it becomes `approved` and proceeds to synthesis and playback

### Requirement: Config-gated synthesis

The worker SHALL synthesize `approved` rows without audio via ElevenLabs and
store the mp3 in the public `tts` storage bucket. A missing API key SHALL log a
clear skip and leave rows pending (they synthesize once the key exists); a
synthesis failure SHALL be logged without crashing the loop.

#### Scenario: No key configured

- **WHEN** rows are approved with no ElevenLabs key configured
- **THEN** the worker logs the skip, rows stay approved without audio, and
  nothing breaks

### Requirement: Overlay playback

The highlight overlay page SHALL play approved-with-audio requests serially —
one at a time, in approval order — through the browser source (so OBS mixes it
into the stream), SHALL display the spoken message in the highlight style while
it plays, and SHALL mark each row `played` when playback ends (or errors) so it
never replays.

#### Scenario: Serial playback with display

- **WHEN** two approved requests have audio
- **THEN** the overlay plays them one after another, showing each message while
  it plays, and marks each `played`

#### Scenario: No replay

- **WHEN** a request has been marked `played`
- **THEN** the overlay never plays it again
