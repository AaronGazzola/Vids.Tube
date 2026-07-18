## ADDED Requirements

### Requirement: Transcription runs only during live

The system SHALL run the whisper transcription job only while a stream's
`status = 'live'`. Widening worker engagement to public pre-live states
(`scheduled`/`preview`) SHALL NOT start transcription, because there is no public
audio feed before go-live.

#### Scenario: No transcription before go-live

- **WHEN** the worker engages a dated `scheduled` broadcast or its `preview`
- **THEN** no `transcript_segments` are written for it

#### Scenario: Transcription starts at go-live

- **WHEN** the engaged stream transitions to `status = 'live'`
- **THEN** the transcription job begins pulling audio and writing
  `transcript_segments`
