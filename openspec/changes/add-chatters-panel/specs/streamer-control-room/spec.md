## ADDED Requirements

### Requirement: A chat author's avatar opens who they are

In the Activity tab's live chat, a message author's avatar SHALL be a click target opening a card
about that person.

The card SHALL show the public membership figures — level, lifetime XP, rank, credits, messages,
broadcasts attended, current streak, best streak, first seen, and badges — using the same figures
component the channel pages already render, rather than a second layout stating the same values.

Below the figures the card SHALL carry that person's remembering points in a collapsible section,
which SHALL start collapsed. The figures SHALL be readable without scrolling the card when the section
is collapsed.

The avatar SHALL be a click target for people speaking in either chat, not only those with a
vids.tube account.

A person with no remembering points SHALL be labelled as being here for the first time, and no
generation SHALL be triggered by opening the card.

Remembering points SHALL be shown only to the channel owner.

#### Scenario: The owner asks who just spoke

- **WHEN** the owner clicks the avatar beside a chat message
- **THEN** a card opens showing that person's membership figures, with their remembering points
  collapsed beneath

#### Scenario: The recall is opened deliberately

- **WHEN** the card opens
- **THEN** the remembering points are collapsed, and the figures are visible without scrolling

#### Scenario: A YouTube chatter is just as clickable

- **WHEN** the owner clicks the avatar beside a message sent from YouTube chat
- **THEN** the same card opens for that person

#### Scenario: Somebody entirely new

- **GIVEN** a person with no remembering points written
- **WHEN** their card is opened
- **THEN** the card states they are here for the first time, and nothing is generated
