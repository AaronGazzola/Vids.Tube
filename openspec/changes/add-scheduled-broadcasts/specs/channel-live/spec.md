## MODIFIED Requirements

### Requirement: Offline placeholder replaces the player

The system SHALL render a placeholder, centered in the page's primary content area,
whenever the channel is not live. When the channel has an upcoming `scheduled`
broadcast (status `scheduled` with a future `scheduled_start_at`), the placeholder
SHALL be a coming-soon card showing that broadcast's thumbnail, title, and a countdown
to its start time (see the `scheduled-broadcasts` capability). When the channel has no
upcoming scheduled broadcast, the placeholder SHALL be the static offline placeholder
and SHALL NOT display a countdown or scheduled time.

#### Scenario: Offline placeholder shown with no upcoming broadcast

- **WHEN** a viewer opens `/[channelSlug]` and the channel is not live and has no
  upcoming scheduled broadcast
- **THEN** a centered static placeholder is shown where the live player would
  otherwise be, with static copy only — no future date, countdown, or schedule
  controls

#### Scenario: Coming-soon card shown for an upcoming broadcast

- **WHEN** a viewer opens `/[channelSlug]` and the channel is not live but has an
  upcoming scheduled broadcast
- **THEN** a centered coming-soon card is shown where the live player would otherwise
  be, displaying the broadcast's thumbnail, title, and a countdown to its
  `scheduled_start_at`
