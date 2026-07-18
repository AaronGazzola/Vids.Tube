## MODIFIED Requirements

### Requirement: Owner TTS panel

The system SHALL surface TTS requests inline in the Activity chat: the chat
message that carries a suggested request renders as a violet-accented card
with the moderation reasoning and Approve/Dismiss controls; approving flips
the request to `approved` (picked up for synthesis), dismissing to
`dismissed`, after which the card relaxes to normal chat styling with a
violet status chip. There SHALL be no separate TTS panel. The Settings tab
SHALL provide an "Auto-TTS (vs suggest)" switch persisted with the one-save
form.

#### Scenario: Approve a suggestion inline

- **WHEN** the owner clicks Approve on a suggested TTS chat card
- **THEN** the request becomes `approved`, proceeds to synthesis and
  playback, and the chat row shows an approved chip instead of the buttons

#### Scenario: Status visible after handling

- **WHEN** a request reaches `approved`, `played`, or `dismissed`
- **THEN** its chat row renders as a normal message with a violet chip naming
  the status
