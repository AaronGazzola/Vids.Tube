## ADDED Requirements

### Requirement: An overlay declares the chat commands it handles

An overlay SHALL be able to declare an ordered list of chat commands, each carrying a keyword and a
description, and optionally a cooldown and a per-stream limit.

An overlay that declares no commands SHALL be valid.

#### Scenario: A declaration is read

- **GIVEN** an overlay declaring a command
- **WHEN** its declaration is read
- **THEN** the keyword and description are returned

#### Scenario: An overlay with nothing to be told

- **GIVEN** an overlay declaring no commands
- **WHEN** it is installed
- **THEN** no commands are registered and nothing is broken

### Requirement: Installing an overlay registers its commands on the channel

Installing an overlay SHALL create its declared commands in the channel's command registry, each marked
as belonging to that overlay. Removing the overlay SHALL delete them.

A registered command SHALL be an ordinary registry row from that moment: the channel owner SHALL be able
to disable it, change its cooldown and its per-stream limit, and it SHALL appear on the channel's public
command guide alongside every other command.

A keyword the channel already uses SHALL NOT be overwritten. It SHALL be left as it is, and the conflict
SHALL be reported to the owner.

#### Scenario: Installing brings commands with it

- **WHEN** a channel installs an overlay declaring a command
- **THEN** that command appears in the channel's registry, marked as belonging to that overlay

#### Scenario: Removing takes them away

- **WHEN** the overlay is removed from the channel
- **THEN** its commands are gone from the registry, and every other command is untouched

#### Scenario: An overlay cannot take a keyword the channel already uses

- **GIVEN** a channel with an existing command
- **WHEN** an overlay declaring the same keyword is installed
- **THEN** the existing command is unchanged, and the conflict is reported

#### Scenario: The streamer keeps control

- **WHEN** the owner disables a command belonging to an overlay
- **THEN** it stops executing, exactly as disabling any other command does

### Requirement: An executed overlay command is recorded and not replied to

Where an executed command belongs to an overlay, the execution SHALL be recorded like any other, and the
system SHALL NOT send a chat reply for it.

Cooldowns, per-stream limits and the enable switch SHALL apply exactly as they do to every other command.

#### Scenario: Nothing is said in chat

- **WHEN** a chatter runs a command belonging to an overlay
- **THEN** the execution is recorded and no reply is posted

#### Scenario: A cooldown still applies

- **WHEN** the same chatter runs it again inside its cooldown
- **THEN** it is refused exactly as any other command would be

### Requirement: A framed overlay receives the commands run for it

The host SHALL provide an endpoint returning executions of commands belonging to the installation named
by a valid overlay token, after a caller-supplied point in time, oldest first and capped in number.

Each event SHALL carry the keyword, any arguments, the time it happened, an actor, and the display name
chat shows for that actor.

An absent, malformed, expired or forged token SHALL be refused, indistinguishably. An overlay SHALL NOT
receive an event belonging to any other overlay or any other channel.

Events SHALL be delivered to a framed overlay over the message channel.

#### Scenario: A chatter's command reaches the overlay

- **GIVEN** a framed overlay whose declared command has been run by a chatter
- **WHEN** the overlay route polls for events
- **THEN** that execution is returned, and is sent to the frame

#### Scenario: Another overlay's command is not delivered

- **GIVEN** two overlays each with commands on the same channel
- **WHEN** one overlay's token is used to read events
- **THEN** only that overlay's executions are returned

#### Scenario: A cold start is not a backlog

- **WHEN** a frame connects for the first time
- **THEN** it is not sent every execution since the installation was created

### Requirement: An actor is named opaquely, per channel per overlay

The actor on an event SHALL be derived rather than stored, and SHALL differ for the same person across
two overlays and across two channels.

The display name SHALL NOT be treated as an identifier: it is for the on-screen moment, and it is neither
stable nor unique.

#### Scenario: The same chatter is unrecognisable across overlays

- **GIVEN** one chatter running commands belonging to two different overlays on one channel
- **WHEN** the actor on each event is compared
- **THEN** the two differ

#### Scenario: The same chatter is unrecognisable across channels

- **GIVEN** one chatter running the same overlay's command on two channels
- **WHEN** the actor on each event is compared
- **THEN** the two differ

#### Scenario: The same chatter is recognisable to one overlay on one channel

- **GIVEN** one chatter running a command twice on the same channel
- **WHEN** the actor on each event is compared
- **THEN** the two match, so an overlay can attribute both to one player
