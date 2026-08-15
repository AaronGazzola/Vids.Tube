## ADDED Requirements

### Requirement: The page and a framed overlay hold a versioned conversation

The host SHALL exchange messages with a framed overlay using `postMessage`. Every message SHALL carry a
namespace identifying this protocol and a version number.

A message whose namespace is not this protocol's SHALL be ignored, since a page receives every frame's
messages on the same listener. A message whose version the receiver does not understand SHALL be ignored
rather than guessed at.

#### Scenario: Another frame's chatter is ignored

- **WHEN** a message arrives carrying no namespace, or a different one
- **THEN** it is ignored and nothing is sent in reply

#### Scenario: A future version is not guessed at

- **WHEN** a message arrives with a version the receiver does not understand
- **THEN** it is ignored

### Requirement: Neither end talks to, or listens to, a stranger

The host SHALL post only to the origin permitted for framing, and SHALL NOT post to a wildcard origin.

The host SHALL accept a message only where its origin is that permitted origin **and** its source is the
window of the frame the host itself rendered. Origin alone SHALL NOT be sufficient, because any document
on that origin would otherwise be able to address the page.

#### Scenario: A message from the right origin but the wrong window is refused

- **GIVEN** a message whose origin is the permitted one
- **WHEN** its source is not the host's own frame
- **THEN** it is ignored

#### Scenario: A message from another origin is refused

- **WHEN** a message arrives from any origin other than the permitted one
- **THEN** it is ignored

#### Scenario: Nothing is broadcast to a wildcard

- **WHEN** the host sends any message
- **THEN** it names the permitted origin as the target

### Requirement: The frame announces itself and is answered

A framed overlay SHALL announce that it is ready. On that announcement the host SHALL send the channel
the overlay is serving, the current settings, and the size of the box the overlay has been given.

The host SHALL send again whenever what it holds changes, so a frame whose announcement was missed is not
stranded until the next edit.

The host SHALL NOT require an announcement in order to function. A frame that never speaks SHALL be left
alone.

#### Scenario: A frame that announces itself is told where it is

- **WHEN** a framed overlay announces that it is ready
- **THEN** it receives the channel it serves, the current settings and its box size

#### Scenario: A frame that says nothing is left alone

- **GIVEN** a framed overlay that does not speak the protocol
- **WHEN** the overlay route runs
- **THEN** nothing is broken, and the frame renders as it always did

### Requirement: The box's size is reported, including the scale the streamer chose

The host SHALL tell a framed overlay the width and height of its box and the scale applied to it, and
SHALL tell it again when any of those change.

The scale SHALL be included because a frame can measure its own viewport but cannot see the scale, which
is the difference between a small overlay and a distant one.

#### Scenario: A resized box is reported

- **WHEN** the box's size or scale changes while the overlay is running
- **THEN** the new size and scale are sent

#### Scenario: An unchanged box is not re-sent

- **WHEN** the overlay route re-renders without the box changing
- **THEN** no size message is sent

