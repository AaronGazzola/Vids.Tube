## ADDED Requirements

### Requirement: A roster of everyone who has spoken in this broadcast

The system SHALL provide the channel owner a roster listing every distinct person who has authored a
chat message in the broadcast being run, across both chat origins. It SHALL list the people in this
broadcast, not the community's membership.

The roster SHALL update as people arrive, without the window being reloaded.

The host SHALL NOT be listed, holding no membership in their own community. Identities marked as
software SHALL NOT be listed.

The roster SHALL be reachable only by the channel owner, and SHALL be empty of remembering points for
anyone whose notes the owner may not read.

Off air, the roster SHALL say there is no broadcast running rather than render an empty list that
reads as a fault.

#### Scenario: Someone speaks for the first time tonight

- **WHEN** a person authors their first message of the broadcast
- **THEN** a row for that person appears in the roster without the window being reloaded

#### Scenario: The roster is this broadcast, not the community

- **GIVEN** a community with many members
- **WHEN** the roster is opened during a broadcast
- **THEN** only the people who have spoken in that broadcast are listed

#### Scenario: The host is not a chatter

- **WHEN** the host speaks in their own chat
- **THEN** no row for the host appears in the roster

#### Scenario: Off air

- **WHEN** the roster is opened with no broadcast running
- **THEN** it states that no broadcast is running

### Requirement: A roster row carries the figures and the recall

Each row SHALL show the person's avatar, their display name, and which chat they are speaking in.

Each row SHALL show the public membership figures: level, lifetime XP, rank, credits, messages,
broadcasts attended, current streak, best streak, and badges.

Each row SHALL show this broadcast's messages and this broadcast's XP alongside the lifetime figures,
so somebody here for the first time is distinguishable at a glance from a regular.

Each row SHALL state when that person was last here before this broadcast, expressed in broadcasts
rather than as a date or a timestamp.

Each row SHALL carry a collapsible section holding that person's remembering points.

A person with no remembering points SHALL be labelled as being here for the first time. No generation
SHALL be triggered by the roster.

#### Scenario: A regular is distinguishable from a newcomer

- **WHEN** the roster lists a person attending their fortieth broadcast beside one attending their
  first
- **THEN** both broadcasts attended and this broadcast's figures are shown, and the two rows read
  differently

#### Scenario: Last seen reads as a gap

- **GIVEN** a person whose previous appearance was three broadcasts ago
- **WHEN** their row is shown
- **THEN** it says they were last here three broadcasts ago

#### Scenario: Nobody has notes yet

- **GIVEN** a person who has never had remembering points written
- **WHEN** their row is shown
- **THEN** the row states they are here for the first time, no empty section is drawn, and nothing is
  generated

### Requirement: A newly arrived person's recall opens itself, once

A row SHALL open its remembering points automatically when that person authors their first message of
the broadcast.

An automatically opened row SHALL close again 5 minutes later.

Opening and closing SHALL always be available by hand.

Closing a row by hand SHALL cancel that row's automatic close. A row opened again after being closed
by hand SHALL stay open.

The automatic close SHALL happen at most once per row per broadcast, and SHALL never be re-armed.

#### Scenario: An arrival is read without being asked for

- **WHEN** a person authors their first message of the broadcast
- **THEN** their row is shown with its remembering points already open

#### Scenario: The row tidies itself away

- **GIVEN** a row opened automatically 5 minutes ago and not touched
- **THEN** it is now closed

#### Scenario: A hand-closed row stays as it is put

- **GIVEN** a row opened automatically and then closed by hand
- **WHEN** the row is opened again by hand
- **THEN** it stays open, and does not close itself later

### Requirement: The roster is a pop-out and not part of the Activity tab

The roster SHALL be rendered in the pop-out window, as a panel distinct from the preview and from the
Activity panel.

The roster SHALL NOT be rendered inside the Activity tab, so that the tab keeps its existing rule that
only the chat scrolls and the chat keeps the space it is given.

The pop-out window SHALL suppress the application chrome, as the existing pop-out panels do.

#### Scenario: The roster opens in its own window

- **WHEN** the owner opens the roster from the Activity tab
- **THEN** a separate window opens showing the roster and no application navigation

#### Scenario: The Activity tab is unchanged in height

- **WHEN** the Activity tab is shown
- **THEN** no roster is drawn within it, and the chat occupies the space it did before
