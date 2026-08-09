## ADDED Requirements

### Requirement: A placeable overlay surface that hosts an external application

The overlay SHALL carry a surface named `Game` alongside the members strip, the goal bars, the
competition ladder, the highlight slot and the break timer. The surface SHALL be placed, scaled, faded
and toggled by the same saved-layout mechanism as those surfaces, on the same 1080 by 1920 stream canvas,
and SHALL appear in the layout editor with a draggable ghost of its own size.

The surface SHALL render one framed document, sized to the surface's nominal dimensions, scaled by the
saved scale like every other surface. The frame SHALL be muted, SHALL be marked as decorative for
assistive technology, and SHALL NOT be scrollable or interactive.

The surface SHALL default to hidden, so no existing saved layout changes appearance when the surface is
introduced.

#### Scenario: The window is placed like any other surface

- **WHEN** the owner drags and scales the Game surface in the layout editor
- **THEN** the surface moves and scales independently of the other surfaces, and the position is saved and
  applied to the overlay

#### Scenario: Existing layouts are undisturbed

- **GIVEN** a saved layout written before the Game surface existed
- **WHEN** that layout is loaded
- **THEN** every other surface keeps its saved position, scale and opacity
- **AND** the Game surface is hidden

#### Scenario: The window makes no sound

- **WHEN** the framed application plays audio
- **THEN** the browser source emits none, because the frame is muted

### Requirement: The framed address is configuration, never data

The framed address SHALL be read from an environment value at build time. It SHALL NOT be read from the
saved layout, from any database row, or from the page's query string, so that no value written by a user
is ever framed.

Where the environment value is absent or is not a valid address, the surface SHALL render nothing, and
the failure SHALL be logged with `console.error`.

#### Scenario: An unconfigured deployment renders no window

- **GIVEN** a deployment with no game address configured
- **WHEN** an overlay whose saved layout shows the Game surface is loaded
- **THEN** no frame is rendered and the rest of the overlay is unaffected

#### Scenario: A user cannot choose what is framed

- **WHEN** a saved layout or a request parameter carries an address
- **THEN** that address is ignored, and the configured address is framed instead

### Requirement: The overlay may frame one named origin, and remains unframeable itself

The Content-Security-Policy SHALL carry a `frame-src` directive naming exactly the origin of the
configured game address. Where no game address is configured, `frame-src 'none'` SHALL be sent.

`frame-ancestors 'none'` and `X-Frame-Options: DENY` SHALL be unchanged: permitting the overlay to frame
one origin SHALL NOT permit anyone to frame the overlay.

No other directive SHALL be broadened by this change.

#### Scenario: The game frame loads

- **GIVEN** the game address is configured and the game is being served at that address
- **WHEN** the overlay is loaded in a browser source
- **THEN** the frame renders, with no Content-Security-Policy violation reported

#### Scenario: Any other origin is still refused

- **WHEN** a frame pointing at an origin other than the configured one is attempted
- **THEN** the policy blocks it

#### Scenario: The overlay still cannot be framed

- **WHEN** a third-party page attempts to embed an overlay route
- **THEN** the browser blocks it, as before
