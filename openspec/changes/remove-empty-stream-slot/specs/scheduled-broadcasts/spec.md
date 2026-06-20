## MODIFIED Requirements

### Requirement: Coming-soon card on the channel page

The system SHALL render a coming-soon card for the channel's scheduled/preview
stream slot (on the standalone live page `/[channelSlug]/live`) when the channel
is not live and has an upcoming `scheduled` broadcast (status `scheduled` with a
future `scheduled_start_at`) or a connected `preview`. The card SHALL show the
broadcast's thumbnail, title, and a countdown to its start time. When the channel
has no live, preview, or upcoming scheduled broadcast, the slot SHALL render
nothing — no static offline placeholder and no "no stream scheduled" card.

#### Scenario: Upcoming broadcast shows a countdown

- **WHEN** a viewer opens `/[channelSlug]/live` while the channel is not live and an
  upcoming scheduled broadcast exists
- **THEN** the page shows a coming-soon card with the broadcast's thumbnail, title,
  and a countdown to `scheduled_start_at`, in place of the live player

#### Scenario: No upcoming broadcast renders nothing

- **WHEN** the scheduled/preview slot is evaluated for a channel that is not live
  and has no upcoming scheduled or preview broadcast
- **THEN** no card is rendered for the slot — no static offline placeholder and no
  "No stream scheduled right now" box appears

#### Scenario: Going live replaces the coming-soon card

- **WHEN** the owner goes live (the broadcast becomes public `live`)
- **THEN** the live page replaces the coming-soon card with the live player and
  chat
