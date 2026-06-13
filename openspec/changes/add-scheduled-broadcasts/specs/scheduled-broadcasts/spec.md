## ADDED Requirements

### Requirement: Create a scheduled broadcast ahead of time

The system SHALL let the channel owner create a future broadcast before any encoder
connects, capturing a title (required, non-empty), an optional description, an
optional thumbnail, and a `scheduled_start_at` time. The system SHALL persist this as
a `streams` row with `status` `scheduled` and SHALL reject creation without a
non-empty title.

#### Scenario: Owner creates a scheduled broadcast

- **WHEN** the owner submits the create form with a non-empty title and a future
  start time (optionally a description and thumbnail)
- **THEN** the system stores a `streams` row with `status` `scheduled`, the given
  `scheduled_start_at`, title, description, and `thumbnail_path`

#### Scenario: Create blocked without a title

- **WHEN** the owner submits the create form with an empty title
- **THEN** the system does not create the broadcast and returns a user-facing error
  indicating a title is required

#### Scenario: Only the owner can create

- **WHEN** an anonymous or non-owner user attempts to create a scheduled broadcast
- **THEN** the system rejects the request and creates no row

### Requirement: Scheduled-broadcast thumbnail upload

The system SHALL let the owner upload a thumbnail for a scheduled broadcast, storing
it in the VOD object store (R2/CDN) so its URL resolves through the same path as VOD
media, and recording the stored key as the broadcast's `thumbnail_path`.

#### Scenario: Owner uploads a thumbnail when scheduling

- **WHEN** the owner uploads an image while creating or editing a scheduled broadcast
- **THEN** the system stores it in the VOD object store, sets the broadcast's
  `thumbnail_path` to its key, and the thumbnail renders from the CDN

### Requirement: Studio Broadcasts list

The system SHALL provide a Studio Broadcasts page that lists the channel's broadcasts
split into upcoming (claimable `scheduled` rows, in start-time order), missed
(`scheduled` rows whose start time is past by more than the grace window), and past
(ended), accessible only to the channel owner.

#### Scenario: Owner views their broadcasts

- **WHEN** the owner opens the Broadcasts page
- **THEN** the page lists upcoming scheduled broadcasts (title, thumbnail, start time),
  any missed scheduled broadcasts marked as missed, and past broadcasts

#### Scenario: Non-owner is denied

- **WHEN** a non-owner (anonymous or non-owner user) opens the Broadcasts page
- **THEN** they are denied access and redirected away

### Requirement: Edit a scheduled broadcast

The system SHALL let the owner edit a scheduled broadcast's title, description,
thumbnail, and start time while it is still `scheduled`, persisting the changes on the
`streams` row, and SHALL reject an edit that clears the title.

#### Scenario: Owner edits a scheduled broadcast

- **WHEN** the owner changes the title, description, thumbnail, or start time of a
  `scheduled` broadcast
- **THEN** the system stores the new values on that row and reflects them in the list
  and the coming-soon card

#### Scenario: Edit blocked without a title

- **WHEN** the owner saves an edit with an empty title
- **THEN** the system does not save and returns a user-facing error indicating a title
  is required

### Requirement: Cancel a scheduled broadcast

The system SHALL let the owner cancel a `scheduled` broadcast that has not been
claimed by an encoder, removing it from the upcoming list and the channel's
coming-soon surface so it can never be claimed into preview.

#### Scenario: Owner cancels an upcoming broadcast

- **WHEN** the owner cancels a `scheduled` broadcast
- **THEN** the system removes it from the upcoming list, it no longer renders as a
  coming-soon card, and a subsequent encoder connect does not claim it

### Requirement: Missed scheduled broadcasts

The system SHALL treat a `scheduled` broadcast whose `scheduled_start_at` is past by
more than the configured grace window as **missed**. A missed broadcast SHALL NOT be
shown as an upcoming coming-soon card and SHALL NOT be claimable by a connecting
encoder (see the `stream-pipeline` capability). The system SHALL NOT auto-delete missed
broadcasts; they SHALL remain visible in the Broadcasts list, marked as missed, for the
owner to delete or cancel manually.

#### Scenario: Scheduled broadcast becomes missed

- **WHEN** a `scheduled` broadcast's start time passes by more than the grace window
  without being claimed
- **THEN** the system marks it missed in the Broadcasts list, stops showing it as a
  coming-soon card, and does not delete it

#### Scenario: Owner deletes a missed broadcast

- **WHEN** the owner deletes or cancels a missed broadcast
- **THEN** the system removes it from the upcoming/missed surfaces (setting the row to
  `ended`) and it can never be claimed

### Requirement: Coming-soon card on the channel page

The system SHALL render a coming-soon card on the channel page `/[channelSlug]` when
the channel is not live and has an upcoming `scheduled` broadcast (status `scheduled`
with a future `scheduled_start_at`). The card SHALL show the broadcast's thumbnail,
title, and a countdown to its start time. When the channel has no upcoming scheduled
broadcast, the page SHALL fall back to the static offline placeholder.

#### Scenario: Upcoming broadcast shows a countdown

- **WHEN** a viewer opens `/[channelSlug]` while the channel is not live and an
  upcoming scheduled broadcast exists
- **THEN** the page shows a coming-soon card with the broadcast's thumbnail, title,
  and a countdown to `scheduled_start_at`, in place of the live player

#### Scenario: No upcoming broadcast falls back to offline

- **WHEN** a viewer opens `/[channelSlug]` while the channel is not live and no
  upcoming scheduled broadcast exists
- **THEN** the page shows the static offline placeholder with no countdown

#### Scenario: Going live replaces the coming-soon card

- **WHEN** the owner goes live (the broadcast becomes public `live`)
- **THEN** the channel page replaces the coming-soon card with the live player and
  chat
