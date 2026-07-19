## MODIFIED Requirements

### Requirement: Moderated TTS request lifecycle

The system SHALL accept `!tts <message>` (200-char argument limit, 180s per-user
cooldown, 5 per user per stream) and SHALL run every request through an AI
moderation verdict before anything is spoken. Failing requests SHALL be
recorded as `suggested` with `flagged: true` and the reason — no reply to the
viewer, nothing synthesized, and never auto-approved, even in auto mode.
Passing requests SHALL become `approved` when `tts_mode` is `auto`, or
`suggested` when it is `suggest`, and the requester SHALL receive an ack reply
saying it is queued or awaiting approval. Auto mode SHALL never bypass
moderation — it only skips the owner's click for passing requests.

#### Scenario: Passing request in suggest mode

- **WHEN** a viewer sends a clean `!tts` message while `tts_mode` is `suggest`
- **THEN** a `suggested` row is created with the moderation reasoning and the
  viewer is told it awaits approval

#### Scenario: Passing request in auto mode

- **WHEN** a viewer sends a clean `!tts` message while `tts_mode` is `auto`
- **THEN** the row is `approved` immediately and the viewer is told it is queued

#### Scenario: Flagged request

- **WHEN** the moderation verdict rejects the message
- **THEN** the row is `suggested` with `flagged: true` and the reason, nothing
  is synthesized yet, no reply is sent, and the row is never auto-approved —
  even while `tts_mode` is `auto`

#### Scenario: Over-length request

- **WHEN** the `!tts` argument exceeds 200 characters
- **THEN** no row is created and the reply explains the limit

### Requirement: Owner TTS panel

The system SHALL surface TTS requests inline in the Activity chat: the chat
message that carries a suggested request renders as a violet-accented card
with the moderation reasoning and Approve/Dismiss controls; a flagged request
renders on the same card with an amber "flagged" chip beside the reasoning and
SHALL offer the same controls. Approving flips the request to `approved`
(picked up for synthesis), dismissing to `dismissed`, after which the card
relaxes to normal chat styling with a violet status chip. There SHALL be no
separate TTS panel. The Settings tab SHALL provide an "Auto-TTS (vs suggest)"
switch persisted with the one-save form.

#### Scenario: Approve a suggestion inline

- **WHEN** the owner clicks Approve on a suggested TTS chat card
- **THEN** the request becomes `approved`, proceeds to synthesis and
  playback, and the chat row shows an approved chip instead of the buttons

#### Scenario: Approve a flagged request

- **WHEN** the owner clicks Approve on a flagged TTS chat card
- **THEN** the request proceeds to synthesis and playback exactly like a
  non-flagged approval

#### Scenario: Status visible after handling

- **WHEN** a request reaches `approved`, `played`, or `dismissed`
- **THEN** its chat row renders as a normal message with a violet chip naming
  the status
