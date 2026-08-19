# overlay-welcome-card Specification

## Purpose
TBD - created by archiving change add-overlay-welcome-card. Update Purpose after archive.
## Requirements
### Requirement: A greeted chatter appears on the broadcast

When a chatter is greeted during a live broadcast, the overlay SHALL show a welcome card naming that
chatter.

The card SHALL be driven by the greeting record the worker writes when it claims the greeting, so the
overlay shows exactly who was greeted in chat and shows nobody who was not.

Each greeting SHALL be shown at most once per overlay session. A greeting written before the overlay
loaded SHALL NOT be replayed on load, so refreshing the browser source does not re-welcome the broadcast.

#### Scenario: A first-time chatter is welcomed

- **GIVEN** a live broadcast with the welcome card enabled
- **WHEN** a chatter is greeted for the first time
- **THEN** the overlay shows a welcome card naming that chatter

#### Scenario: A greeting is not repeated

- **GIVEN** a welcome card that has already been shown
- **WHEN** the overlay polls again and the same greeting is still returned
- **THEN** nothing is shown a second time

#### Scenario: Refreshing the browser source

- **GIVEN** a broadcast in which several chatters have already been greeted
- **WHEN** the OBS browser source is refreshed
- **THEN** no past greeting is replayed

#### Scenario: Off air

- **GIVEN** no live broadcast
- **THEN** no welcome card is shown

### Requirement: The welcome card is laid out avatar above, message below

The welcome card SHALL draw the chatter's avatar above the message, with the message below it, rather
than the avatar-beside-bubble arrangement the featured message uses.

The avatar SHALL be drawn by the same avatar component the rest of the overlay uses, so a chatter's
picture, its fallback and its sizing behave identically wherever they appear.

The card SHALL scale with the box the streamer sized, and SHALL read on a 1080x1920 canvas at broadcast
scale.

#### Scenario: The card is drawn

- **WHEN** a welcome card is shown
- **THEN** the chatter's avatar is above and the greeting message is below it

#### Scenario: A chatter with no picture

- **GIVEN** a chatter whose channel carries no avatar
- **WHEN** their welcome card is shown
- **THEN** the same placeholder the rest of the overlay uses is drawn, and the card's shape is unchanged

### Requirement: A new member reads differently from a returning one

The welcome card SHALL distinguish a chatter arriving for the first time from one returning, using the
kind already recorded against the greeting.

A burst of arrivals greeted together SHALL be shown as one card naming them, matching the single combined
message the greeting step sends to chat rather than showing a separate card each.

#### Scenario: A new member

- **WHEN** a first-time chatter's welcome card is shown
- **THEN** the card presents them as a new member

#### Scenario: A returning member

- **WHEN** a returning chatter's welcome card is shown
- **THEN** the card presents them as returning, distinctly from a new member

#### Scenario: A burst of arrivals

- **GIVEN** enough chatters arrive at once that the greeting step sends one combined message
- **WHEN** the overlay shows the arrival
- **THEN** one card names them together, rather than one card per chatter

### Requirement: The welcome shares the feed slot and holds for eight seconds

The welcome card SHALL be drawn in the shared feed slot, below the featured message, the TTS card and the
ask exchange in priority, so that no two of them are ever on screen at once.

A welcome card SHALL hold for eight seconds and then release the slot.

The welcome SHALL have its own visibility toggle. Turned off, no welcome card SHALL be drawn and the
other feed contents SHALL be unaffected.

#### Scenario: A highlight takes precedence

- **GIVEN** a featured message waiting to be shown and a greeting waiting to be shown
- **THEN** the featured message is shown first, and the welcome follows once the slot is free

#### Scenario: The card releases the slot

- **WHEN** a welcome card has been shown for eight seconds
- **THEN** it is removed and the slot is free for whatever is waiting

#### Scenario: The welcome is switched off

- **GIVEN** the welcome's visibility toggle is off
- **WHEN** a chatter is greeted
- **THEN** no welcome card is drawn, and featured messages, TTS cards and ask exchanges still show

#### Scenario: A layout saved before the welcome existed

- **GIVEN** a layout saved before the welcome had a toggle
- **WHEN** the overlay is drawn
- **THEN** the welcome takes its default and no saved box position is discarded

