## MODIFIED Requirements

### Requirement: A framed overlay reads its own settings with its token

The host SHALL provide an endpoint that returns the settings of the installation named by a valid
overlay token, presented as a bearer credential.

An absent, malformed, expired or forged token SHALL be refused, and the refusals SHALL be
indistinguishable from one another. An overlay SHALL NOT be able to read the settings of any installation
other than the one its token names.

The endpoint SHALL be reachable from the origin the framing policy permits, since the caller is a framed
document on another origin.

Settings SHALL additionally be delivered over the message channel, both when a framed overlay announces
itself and whenever they change, so that a change the streamer saves reaches a running overlay without
that overlay being reloaded. The endpoint SHALL remain available for an overlay that does not speak the
protocol.

#### Scenario: An overlay reads what the streamer configured

- **GIVEN** an installation whose settings have been set by the channel owner
- **WHEN** the framed overlay presents its token
- **THEN** those settings are returned, with declared defaults filled in

#### Scenario: A token for another installation reads nothing of this one

- **GIVEN** two installations of the same overlay on different channels
- **WHEN** one installation's token is presented
- **THEN** only that installation's settings are returned

#### Scenario: A refused read says only that it was refused

- **WHEN** a missing, malformed, expired or forged token is presented
- **THEN** each is refused identically

#### Scenario: A saved change reaches a running overlay

- **GIVEN** a framed overlay that has announced itself
- **WHEN** the channel owner saves a different value
- **THEN** the new settings are sent to that frame without it being reloaded
