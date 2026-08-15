## MODIFIED Requirements

### Requirement: A channel installs an overlay, and the installation is its per-channel identity

The system SHALL record an installation joining one channel to one overlay. A channel SHALL NOT hold two
installations of the same overlay. An installation SHALL carry an id of its own, unguessable and stable
for the life of the installation, and that id SHALL be the name by which this overlay on this channel is
identified.

An installation SHALL carry an enabled flag, so an installed overlay can be silenced without being
removed.

Installing an overlay SHALL register the chat commands it declares on that channel, and removing it SHALL
withdraw them.

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

#### Scenario: Installing and removing carries the commands with it

- **WHEN** a channel installs an overlay declaring commands and later removes it
- **THEN** those commands appear in the channel's registry while installed and are gone afterwards
