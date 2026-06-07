## ADDED Requirements

### Requirement: Channel home at root

The system SHALL render the owner's channel at `/`, showing a live-status banner
and a grid of the channel's videos.

#### Scenario: Owner not streaming

- **WHEN** a visitor opens `/` and the channel is not live
- **THEN** the page shows the channel header, a not-live banner, and a video grid
  (placeholder cards for now)

#### Scenario: Owner streaming

- **WHEN** the channel is live
- **THEN** the banner shows a live state linking to the live page

### Requirement: VOD watch page

The system SHALL provide a VOD watch page at `/watch/[videoId]` with a video
area, title/description, and a comments area.

#### Scenario: Opening a VOD

- **WHEN** a visitor opens `/watch/<id>`
- **THEN** the page renders a player placeholder, the video metadata, and a
  comments placeholder

### Requirement: Live watch page

The system SHALL provide a live watch page at `/live` with a live video area and
a chat area.

#### Scenario: Opening the live page

- **WHEN** a visitor opens `/live`
- **THEN** the page renders a live-player placeholder and a chat placeholder

### Requirement: Free-viewer-cap sign-in wall

The system SHALL provide a sign-in wall component that gates live viewing beyond
the free anonymous cap, prompting the visitor to sign in.

#### Scenario: Anonymous viewer past the cap

- **WHEN** the sign-in wall is shown to an anonymous viewer
- **THEN** it explains that signing in (free) is required to keep watching and
  links to sign in / sign up

### Requirement: Credits page

The system SHALL provide a credits page at `/credits` showing the current balance,
available credit packages, and transaction history (balance and history stubbed;
purchase marked as coming soon).

#### Scenario: Viewing credits

- **WHEN** an authenticated user opens `/credits`
- **THEN** the page shows a balance, placeholder credit packages with a
  coming-soon purchase state, and a placeholder transaction history
