# studio Specification

## Purpose
TBD - created by archiving change add-v1-ui-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Owner-only Studio area

The system SHALL provide a Studio area under `/studio` with its own sidebar
navigation, accessible only to the channel owner.

#### Scenario: Owner opens Studio

- **WHEN** the owner opens `/studio`
- **THEN** the Studio shell renders with a sidebar linking to Upload, Go Live,
  Broadcasts, Videos, and Settings

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

### Requirement: Go Live tool

The system SHALL provide a working go-live control surface at `/studio/live` that
reflects the broadcast's current state: stream connection details when idle, a
preview-and-setup experience while in `preview`, and a live-management experience
while `live`.

#### Scenario: Idle — connection details

- **WHEN** the owner opens `/studio/live` and no broadcast is connected
- **THEN** the page shows the RTMP server URL and stream key (with regenerate) so
  the owner can configure their encoder

#### Scenario: Preview — set up and go live

- **WHEN** the owner opens `/studio/live` while a broadcast is in `preview`
- **THEN** the page shows a self-preview player, a setup form for title
  (required), description, and thumbnail, and a Go live control that is disabled
  until a non-empty title is set

#### Scenario: Live — manage the broadcast

- **WHEN** the owner opens `/studio/live` while the broadcast is `live`
- **THEN** the page shows a live indicator and an End control to stop the
  broadcast (live viewer count is tracked separately under analytics, AZ-26)

### Requirement: Broadcasts tool

The system SHALL provide a Broadcasts page at `/studio/broadcasts` where the owner can
view upcoming and past broadcasts and create, edit, or cancel a scheduled broadcast
(see the `scheduled-broadcasts` capability for the authoring behavior).

#### Scenario: Owner opens Broadcasts

- **WHEN** the owner opens `/studio/broadcasts`
- **THEN** the page renders the upcoming and past broadcast lists with controls to
  create, edit, and cancel scheduled broadcasts

#### Scenario: Non-owner opens Broadcasts

- **WHEN** a non-owner opens `/studio/broadcasts`
- **THEN** they are denied access and redirected away

