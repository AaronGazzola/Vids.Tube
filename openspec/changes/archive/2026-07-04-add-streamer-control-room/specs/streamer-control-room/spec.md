## ADDED Requirements

### Requirement: Owner-only control room

The system SHALL provide an owner-only `/studio/control` route, guarded so non-owners are
redirected away, laid out as a dense window the owner can pop out beside OBS.

#### Scenario: Non-owner is redirected

- **WHEN** a signed-out or non-owner user opens `/studio/control`
- **THEN** they are redirected away and do not see the control room

#### Scenario: Owner sees the operating view

- **WHEN** the owner opens `/studio/control`
- **THEN** the page renders immediately with a live/offline badge and panels for chat,
  the read-this queue, and a goal/score glance

### Requirement: AI read-this queue

The control room SHALL show the AI-featured messages for the current stream, newest
first, with the message text, the AI's reason, and category tags, so the owner knows
which messages to read out. The owner SHALL be able to dismiss an item from the queue.

#### Scenario: Featured messages surface for the owner

- **WHEN** the scoring bot features a message during the stream
- **THEN** it appears in the read-this queue with its text and the AI's reason

#### Scenario: Dismissing a read item

- **WHEN** the owner marks a read-this item as read
- **THEN** it is removed from the owner's queue view

### Requirement: Live chat with moderation slots

The control room SHALL show the live chat (realtime) with author identity, and SHALL
present per-message and per-author moderation controls. Until the moderation engine ships,
these controls SHALL be present but inert (disabled), so enabling them later is additive.

#### Scenario: Chat streams in realtime

- **WHEN** a viewer posts a chat message during the stream
- **THEN** it appears in the control room's chat panel without a reload

#### Scenario: Moderation controls are visible but inert

- **WHEN** the owner views a chat message or an author in the control room
- **THEN** a Hide control (per message) and a Ban control (per author) are shown disabled,
  indicating moderation is not yet enabled
