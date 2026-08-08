## ADDED Requirements

### Requirement: One greeting per chatter per broadcast

The worker SHALL send at most one greeting per chatter per broadcast, triggered by that chatter's first message of the broadcast. The host, any channel marked as software, and any banned participant SHALL never be greeted. A command message SHALL still trigger the greeting, because a chatter whose first message is `!me` is as new as anyone else.

The greeting SHALL be composed only after the chatter's membership in the broadcast's community exists, so the greeting can state the member's standing and link to a page that resolves.

#### Scenario: A chatter is greeted once

- **WHEN** a chatter sends their second, third and fourth messages of a broadcast
- **THEN** no further greeting is sent for that chatter during that broadcast

#### Scenario: The host is never greeted

- **WHEN** the host sends their first message of their own broadcast
- **THEN** no greeting is sent

#### Scenario: The delivery bot is never greeted

- **WHEN** a message arrives from a channel marked as software
- **THEN** no greeting is sent

#### Scenario: A greeting survives a worker restart

- **WHEN** the worker restarts mid-broadcast and a chatter who was already greeted sends another message
- **THEN** no second greeting is sent, because whether a chatter has been greeted is recorded durably rather than held only in memory

### Requirement: A first-time chatter is welcomed as a new member

When the chatter has no chat history in this community before this broadcast, the greeting SHALL welcome them as a new member, SHALL state that their membership was created by sending a message, and SHALL carry a clickable link to their own channel page anchored to this community's membership.

#### Scenario: New chatter is told they are now a member

- **WHEN** an account with no prior history in this community sends its first message
- **THEN** the reply welcomes them as a new member and contains a link to their own channel page

### Requirement: A returning chatter is welcomed back

When the chatter has chat history in this community before this broadcast, the greeting SHALL welcome them back with a short line drawn from what they have said before, and SHALL carry the same clickable link to their own channel page.

The line SHALL be produced by the same profile generation and caching path that already serves the `!me` command, so a returning chatter's greeting and their `!me` reply cannot describe them differently.

#### Scenario: Returning chatter gets a personal line

- **WHEN** an account with prior history in this community sends its first message of a broadcast
- **THEN** the reply refers to their past participation and contains a link to their own channel page

#### Scenario: Greeting and the me command agree

- **WHEN** a returning chatter is greeted and then runs `!me` in the same broadcast
- **THEN** both replies draw on the same cached profile rather than generating two different descriptions

### Requirement: The greeting link is clickable and personal

Every individual greeting SHALL contain exactly one link, addressing the chatter's own channel page with the `https://` scheme, because YouTube live chat renders a link only when the scheme is present. The link SHALL carry the anchor identifying this community's membership. The greeting SHALL NOT contain the shared address as well, so the single link is unambiguous.

#### Scenario: The scheme is present

- **WHEN** a greeting is sent to YouTube chat
- **THEN** its link begins with `https://` and is therefore rendered as a link by YouTube

#### Scenario: Only one link per greeting

- **WHEN** an individual greeting is composed
- **THEN** it contains the chatter's own link and no other address

### Requirement: A burst of arrivals is greeted together

When more than 5 chatters are waiting to be greeted at once, the worker SHALL name the waiting chatters together in a single message carrying the fixed address `vids.tube/...` and no personal links, rather than sending an individual greeting to each. Below that threshold every chatter SHALL receive an individual greeting.

This exists because each YouTube send occupies chat for about 5.2 seconds; recent broadcasts draw between 2 and 8 chatters, so the individual path is the normal one and the combined path is a safety valve.

#### Scenario: An ordinary broadcast greets everyone individually

- **WHEN** 8 chatters arrive across a broadcast, never more than 5 waiting at once
- **THEN** each of the 8 receives their own greeting with their own link

#### Scenario: A flood is greeted in one message

- **WHEN** more than 5 chatters are waiting to be greeted
- **THEN** the waiting chatters are named in a single message carrying the fixed address and no personal links

### Requirement: The returning greeting is switchable per broadcast

The system SHALL provide a per-broadcast setting on the `/live` settings tab that turns the returning-chatter greeting on and off, defaulting to on. The first-time chatter greeting SHALL NOT be switchable, because a new member being told they are a member is the purpose of the feature.

#### Scenario: Returning greetings are turned off

- **WHEN** the setting is off and a returning chatter sends their first message of the broadcast
- **THEN** no greeting is sent, and a first-time chatter in the same broadcast is still greeted
