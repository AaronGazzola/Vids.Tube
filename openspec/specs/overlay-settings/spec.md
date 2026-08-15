# overlay-settings Specification

## Purpose
TBD - created by archiving change add-overlay-settings. Update Purpose after archive.
## Requirements
### Requirement: An overlay declares the fields its settings have

An overlay SHALL be able to declare an ordered list of settings fields. Each field SHALL carry a key, a
label and a type, and MAY carry a default, help text, a range, a step and a list of options.

The supported types SHALL be a number, a toggle, text, a choice and a colour. The host SHALL render an
input from the declaration and SHALL NOT attach meaning to any value.

An overlay that declares no fields SHALL be valid, and SHALL present an empty editor rather than an
error.

#### Scenario: An input is drawn from the declaration

- **GIVEN** an overlay declaring a number field with a minimum, a maximum and a step
- **WHEN** the channel owner opens that overlay's settings
- **THEN** a slider bounded by that range is shown, labelled with the declared label

#### Scenario: An overlay with nothing to configure

- **GIVEN** an overlay declaring no fields
- **WHEN** the channel owner opens its settings
- **THEN** an empty state is shown and nothing is broken

### Requirement: Settings are stored per channel per overlay, and never interpreted

Each installation SHALL hold its own settings as an object. The host SHALL store, return and edit those
values without attaching meaning to any of them.

Values SHALL be stored whole. A stored value whose key the overlay no longer declares SHALL be retained
rather than discarded, so a field withdrawn in one release and restored in the next does not lose the
streamer's choice.

On read, a declared field the streamer has not set SHALL be filled with its declared default, so an
overlay never receives a gap for a field it declared.

#### Scenario: Two channels configure the same overlay independently

- **GIVEN** two channels that have each installed the same overlay
- **WHEN** each sets a different value for the same field
- **THEN** each channel reads back its own value

#### Scenario: A withdrawn field keeps its value

- **GIVEN** a stored value for a field the overlay has since stopped declaring
- **WHEN** the settings are written again
- **THEN** that value is still stored

#### Scenario: An unset field reads as its default

- **GIVEN** a declared field the streamer has never set
- **WHEN** the settings are read
- **THEN** the declared default is returned for it

### Requirement: The host validates shape, never meaning

A written value SHALL be checked against its declared type, and against a declared range, step or option
list where one exists. Text SHALL have a length ceiling.

A write naming a key the overlay does not declare SHALL be rejected. A write whose value does not match
its declared type or bounds SHALL be rejected. No other judgement SHALL be made about a value.

#### Scenario: A number outside its declared range is refused

- **WHEN** a value above the declared maximum is written
- **THEN** the write is refused and nothing is stored

#### Scenario: An undeclared key cannot be written

- **WHEN** a write names a key the overlay does not declare
- **THEN** the write is refused

#### Scenario: A meaningful-looking value is not judged

- **GIVEN** a declared number field with no declared range
- **WHEN** any finite number is written
- **THEN** it is stored

### Requirement: Only the channel owner edits an installation's settings

Reading and writing an installation's settings through the owner-facing surface SHALL be permitted only
to the owner of the channel it belongs to.

#### Scenario: Another account cannot read or write

- **WHEN** an account that does not own the channel attempts to read or write that channel's overlay
  settings
- **THEN** the attempt returns nothing and changes nothing

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

