## MODIFIED Requirements

### Requirement: The framed address is configuration, never data

The framed **origin** SHALL be read from an environment value at build time, and SHALL NOT be read from
the saved layout, from any database row, or from the page's query string.

The framed **path, query and fragment** SHALL be derived from the overlay installed on the channel being
rendered: the entry address recorded in the overlay registry, with a signed token for that installation
appended as a `t` query parameter. The rest of the authored entry address SHALL be carried through
unaltered, and SHALL NOT be interpreted by the host.

Where the channel has no enabled installation, where the environment value is absent or is not a valid
address, or where the entry address's origin is not the build-time origin, the surface SHALL render
nothing, and the failure SHALL be logged with `console.error`.

Registry rows are authored by an overlay's owner and admitted to the registry. No address written by a
viewer, by a streamer, or by a saved layout SHALL ever be framed.

#### Scenario: An unconfigured deployment renders no window

- **GIVEN** a deployment with no game origin configured
- **WHEN** an overlay whose saved layout shows the Game surface is loaded
- **THEN** no frame is rendered and the rest of the overlay is unaffected

#### Scenario: A channel with nothing installed renders no window

- **GIVEN** a channel with no enabled installation
- **WHEN** an overlay whose saved layout shows the Game surface is loaded
- **THEN** no frame is rendered and the rest of the overlay is unaffected

#### Scenario: A user cannot choose what is framed

- **WHEN** a saved layout or a request parameter carries an address
- **THEN** that address is ignored, and the installed overlay's address is framed instead

#### Scenario: Two channels frame two addresses

- **GIVEN** two channels that have each installed the same overlay
- **WHEN** both overlay routes are loaded
- **THEN** each frame carries a token naming that channel and that channel's own installation

#### Scenario: The authored address is carried through

- **GIVEN** an entry address that already carries query parameters of its own
- **WHEN** the frame is rendered
- **THEN** those parameters are present unchanged, alongside the appended `t` parameter
