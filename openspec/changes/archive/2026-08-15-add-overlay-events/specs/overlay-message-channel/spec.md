## ADDED Requirements

### Requirement: Events reach a framed overlay over the message channel

The host SHALL send a framed overlay each event it has been sent for, once it has announced itself.

An event SHALL NOT be sent twice for the same execution, and events SHALL be sent in the order they
happened.

A frame that has not announced itself SHALL NOT be sent events, and SHALL NOT be sent them later once it
does: the announcement begins the conversation rather than replaying it.

#### Scenario: An execution reaches a listening frame

- **GIVEN** a framed overlay that has announced itself
- **WHEN** a chatter runs one of that overlay's commands
- **THEN** the frame receives an event naming the keyword and the actor

#### Scenario: Nothing is sent twice

- **WHEN** the host polls again after delivering an event
- **THEN** that event is not sent a second time
