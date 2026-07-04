## ADDED Requirements

### Requirement: Highlight shows the chat message as a card

The highlight overlay SHALL present a featured message as a card rather than a
fly-across name: the author's `AvatarBubble` (ring + rank badge) on the left with
`@handle` and name beneath it, and a speech bubble to the right showing the message
text, with a tail near the bubble's top-left pointing at the avatar. The card SHALL
animate in, hold, and fade out, then advance to the next featured message.

#### Scenario: A featured message shows its text

- **WHEN** a message is featured
- **THEN** the overlay shows the author's ringed/badged avatar with `@handle`/name and a
  speech bubble containing what they said

#### Scenario: Cards play one at a time

- **WHEN** several messages are featured close together
- **THEN** their cards play in sequence, not overlapping

### Requirement: Featured messages carry their text

`featured_messages` SHALL store the message text in a `body` column, written by the
scoring engine when it features a message, so the highlight can display it (including
for YouTube messages that have no `chat_messages` row).

#### Scenario: The engine records the text

- **WHEN** the scoring engine features a message
- **THEN** the `featured_messages` row's `body` holds that message's text

#### Scenario: The author is ringed by current standing

- **WHEN** a featured author is shown in the card
- **THEN** their avatar's ring and badge reflect their current standing in the stream's
  `viewer_scores`
