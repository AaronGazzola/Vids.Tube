## ADDED Requirements

### Requirement: Overlay control lives in the /live Settings tab

The system SHALL provide overlay control from the `/live` Settings tab rather than a
separate control route: the copyable OBS browser-source URLs (Highlights, Goal subs,
Goal likes, Goal viewers, Competition) with their dimensions, the competition opacity
control, the YouTube stream URL, the goals targets, and the mod bot / scoring
switches. The overlay URLs SHALL be copyable regardless of stream state; the overlay
**content** settings SHALL be stored on the single active stream.

#### Scenario: Copy overlay URLs without an active stream

- **WHEN** the owner opens the `/live` Settings tab with no active stream
- **THEN** all overlay URLs and dimensions are shown and copyable

#### Scenario: Overlay content is per-stream

- **WHEN** the owner sets the YouTube URL, goals, or scoring/highlighting switches
- **THEN** the values are stored on the active stream and consumed by the overlay
  renderers for that stream
