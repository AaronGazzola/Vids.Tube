## ADDED Requirements

### Requirement: Owner-only Studio area

The system SHALL provide a Studio area under `/studio` with its own sidebar
navigation, accessible only to the channel owner.

#### Scenario: Owner opens Studio

- **WHEN** the owner opens `/studio`
- **THEN** the Studio shell renders with a sidebar linking to Upload, Go Live,
  Videos, and Settings

#### Scenario: Non-owner opens Studio

- **WHEN** a non-owner (anonymous or non-owner user) opens any `/studio` route
- **THEN** they are denied access and redirected away (e.g. to login or home)

### Requirement: Studio overview

The system SHALL provide a Studio overview at `/studio` summarizing channel
status (placeholder metrics).

#### Scenario: Viewing the overview

- **WHEN** the owner opens `/studio`
- **THEN** the overview shows placeholder summary cards and links into the tools

### Requirement: Upload tool (placeholder)

The system SHALL provide an upload page at `/studio/upload` with an upload UI
shell in a coming-soon state.

#### Scenario: Opening upload

- **WHEN** the owner opens `/studio/upload`
- **THEN** a dropzone/upload shell renders in a disabled coming-soon state

### Requirement: Go Live tool (placeholder)

The system SHALL provide a go-live page at `/studio/live` showing stream setup
(e.g. stream key area) in a coming-soon state.

#### Scenario: Opening go live

- **WHEN** the owner opens `/studio/live`
- **THEN** a stream-setup shell renders with the start-stream action disabled

### Requirement: Videos management (placeholder)

The system SHALL provide a videos page at `/studio/videos` listing the channel's
videos (placeholder rows).

#### Scenario: Opening videos

- **WHEN** the owner opens `/studio/videos`
- **THEN** a video list shell renders with placeholder rows and disabled actions

### Requirement: Channel settings (placeholder)

The system SHALL provide a settings page at `/studio/settings` for channel
details (name, description, avatar/banner) in a stubbed state.

#### Scenario: Opening settings

- **WHEN** the owner opens `/studio/settings`
- **THEN** a settings form renders with shadcn inputs; submission is stubbed
