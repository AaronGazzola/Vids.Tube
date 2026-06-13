## MODIFIED Requirements

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

## ADDED Requirements

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
