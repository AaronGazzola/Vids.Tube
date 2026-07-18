## ADDED Requirements

### Requirement: Scheduled waiting room on the public surface

The system SHALL render a waiting room on the public live surface for a dated pre-live
broadcast (a `scheduled` broadcast, or its `preview` while the audience still waits):
a countdown to `scheduled_start_at`, a waiting count of present viewers, and — when
`waiting_room_chat` is on — the live chat. At go-live the same surface SHALL replace
the countdown with the live player without navigating away, preserving the chat. A
private `draft` or ad-hoc `preview` SHALL render nothing public.

#### Scenario: Audience waits and chats before go-live

- **WHEN** a viewer opens the public surface for a dated `scheduled` broadcast with
  `waiting_room_chat` on
- **THEN** they see a countdown, a waiting count, and the chat they can read (and post
  to when signed in)

#### Scenario: Countdown becomes the live player at go-live

- **WHEN** the owner goes live from that broadcast
- **THEN** the same surface swaps the countdown for the live player, and the chat
  continues uninterrupted

#### Scenario: Private broadcast is not shown

- **WHEN** the active stream is a `draft` or an ad-hoc `preview`
- **THEN** the public surface shows no waiting room and no countdown for it
