## ADDED Requirements

### Requirement: Framed overlays exist as registry rows

The system SHALL hold a registry of framed overlays. Each overlay SHALL carry an id, a unique lowercase
slug, a display name, an entry address, an optional owner account, and a status of `draft`, `published`
or `disabled`.

An overlay with no owner account SHALL be treated as first-party. The absence of an owner SHALL NOT grant
the overlay any capability another overlay lacks.

Only an overlay whose status is `published` SHALL be offered for installation. The dragon game SHALL be
one row in this registry and SHALL NOT be privileged over any other row.

#### Scenario: A published overlay is offered

- **GIVEN** an overlay row whose status is `published`
- **WHEN** the channel owner opens the install list
- **THEN** that overlay is listed and can be installed

#### Scenario: A draft or disabled overlay is not offered

- **GIVEN** an overlay row whose status is `draft` or `disabled`
- **WHEN** the channel owner opens the install list
- **THEN** that overlay is not listed, and it cannot be installed

#### Scenario: The first-party overlay is not special

- **WHEN** the registry is read
- **THEN** the dragon game appears as an ordinary row, distinguished only by having no owner account

### Requirement: A channel installs an overlay, and the installation is its per-channel identity

The system SHALL record an installation joining one channel to one overlay. A channel SHALL NOT hold two
installations of the same overlay. An installation SHALL carry an id of its own, unguessable and stable
for the life of the installation, and that id SHALL be the name by which this overlay on this channel is
identified.

An installation SHALL carry an enabled flag, so an installed overlay can be silenced without being
removed.

Deleting a channel or an overlay SHALL delete its installations.

#### Scenario: Two channels install the same overlay

- **GIVEN** two channels that have each installed the same overlay
- **WHEN** both overlays are rendered
- **THEN** each carries a different installation id, and neither channel's installation affects the other

#### Scenario: Installing twice is refused

- **WHEN** a channel that already has an overlay installed installs it again
- **THEN** the second installation is refused and the existing one is unchanged

#### Scenario: An installation survives edits to the overlay

- **WHEN** the overlay's name or entry address is changed in the registry
- **THEN** every installation keeps its id

### Requirement: Only an overlay whose entry origin is the permitted origin is framed

The origin permitted for framing SHALL remain a build-time value. An installation whose overlay entry
address has any other origin SHALL NOT be framed, SHALL render nothing, and the refusal SHALL be logged
with `console.error`.

This SHALL hold whatever the registry says, so that no address reachable through a database row can cause
a foreign origin to be framed.

#### Scenario: A matching origin is framed

- **GIVEN** an installed overlay whose entry address has the permitted origin
- **WHEN** the overlay route is loaded
- **THEN** the frame renders that address

#### Scenario: A foreign origin is refused

- **GIVEN** an installed overlay whose entry address has an origin other than the permitted one
- **WHEN** the overlay route is loaded
- **THEN** nothing is framed, the rest of the overlay is unaffected, and the refusal is logged

#### Scenario: The streamer is told why nothing renders

- **GIVEN** an installed overlay whose entry origin is not permitted
- **WHEN** the channel owner opens the install list
- **THEN** that installation is marked as not renderable

### Requirement: The channel owner installs and removes overlays

The system SHALL provide the channel owner a control listing the published overlays, showing which are
installed on their channel, and allowing an overlay to be installed or removed. The control SHALL live
with the existing overlay controls on the `/live` Overlays tab.

Reading and writing an installation SHALL be permitted only to the owner of the channel it belongs to.

#### Scenario: Install then remove

- **WHEN** the channel owner installs a published overlay and then removes it
- **THEN** the overlay is framed on their overlay after installing, and nothing is framed after removing

#### Scenario: Another account cannot read or change an installation

- **WHEN** an account that does not own the channel attempts to read or change that channel's
  installations
- **THEN** the attempt returns nothing and changes nothing
