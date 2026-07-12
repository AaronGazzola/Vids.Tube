## ADDED Requirements

### Requirement: Chat in the scheduled waiting room

The system SHALL make chat read and post available for a public pre-live broadcast
(a dated `scheduled` broadcast or its `preview`) when `waiting_room_chat` is on, not
only for `live`. Read SHALL be public; posting SHALL require authentication, with RLS
permitting inserts to a public pre-live stream only when `waiting_room_chat` is true.
Waiting-room chat SHALL be scoped to the same stream id as the eventual live show, so
messages posted during the wait persist into the live broadcast.

#### Scenario: Authenticated viewer posts in the waiting room

- **WHEN** an authenticated viewer posts in the waiting room of a dated `scheduled`
  broadcast with `waiting_room_chat = true`
- **THEN** the message is inserted for that stream id and appears for all viewers in
  real time, and remains visible when the broadcast goes live

#### Scenario: Posting blocked when waiting-room chat is off

- **WHEN** a viewer attempts to post to a `scheduled`/`preview` stream with
  `waiting_room_chat = false` (or a private stream)
- **THEN** row-level security rejects the insert

#### Scenario: Anonymous viewer reads but cannot post

- **WHEN** an anonymous viewer opens the waiting room with chat enabled
- **THEN** they see messages in real time and the composer is replaced by a sign-in
  prompt
