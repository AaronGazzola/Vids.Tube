## ADDED Requirements

### Requirement: The members box replaces the subs goal box

The overlay layout SHALL offer a members box in place of the subs goal box. The members box SHALL be positionable, scalable, toggleable and opacity-adjustable exactly as the other overlay boxes are, and SHALL be saved in the same overlay layout as the rest.

The saved layout version SHALL be bumped so the members box does not inherit the subs box's coordinates. Bumping the version SHALL NOT discard the positions of any other box.

The likes goal and the viewers goal SHALL be unchanged.

#### Scenario: The subs box is gone

- **WHEN** the owner opens the overlay layout editor
- **THEN** no subs goal box is offered, and a members box is offered in its place

#### Scenario: The other goals survive

- **WHEN** the members box is added
- **THEN** the likes goal and viewers goal boxes render and behave as before

### Requirement: A version bump never discards saved positions

Loading a layout saved under an older version SHALL carry every saved box position forward unchanged. A box SHALL be reset to its default only when that specific box's coordinates changed meaning at a version, declared per version; a box that is newly introduced, absent from the saved layout, or saved as an unreadable value SHALL take its default.

Overlay positions are set by hand against a live picture and are expensive to redo. Discarding them wholesale on a version bump has cost the owner their layout before, so the reset is scoped to the boxes that actually moved rather than applied to all of them.

#### Scenario: An older layout keeps every position

- **WHEN** a layout saved under an earlier version is loaded and no box's coordinates changed meaning
- **THEN** every saved box keeps its exact position, scale, toggle and opacity

#### Scenario: A newly added box takes its default

- **WHEN** a layout saved before the members strip existed is loaded
- **THEN** the members strip takes its default position and every other box keeps the position the owner set

#### Scenario: A removed box disappears without disturbing the rest

- **WHEN** a saved layout still carries the retired subs box
- **THEN** that box is dropped and no other box moves

#### Scenario: An unreadable saved box falls back alone

- **WHEN** one saved box holds a non-numeric position
- **THEN** that box takes its default and the other boxes keep their saved positions

### Requirement: The members box shows the count and the call to action

The members box SHALL display the community's member total and a call to action telling viewers that sending a message in chat makes them a member, naming the address as `vids.tube/...` without a scheme, because the overlay is read rather than clicked.

#### Scenario: The box states how to join

- **WHEN** the members box renders during a broadcast
- **THEN** it shows the member total and text telling the viewer that sending a chat message makes them a member, naming `vids.tube/...`

### Requirement: The members box is a thin horizontal strip

The members box SHALL be laid out as a thin horizontal strip spanning about three quarters of the width of the 1080-wide vertical broadcast canvas, with the count and the call to action arranged along its length rather than stacked into a block.

The strip SHALL be compact in height, because it competes for vertical space with the goals, the competition ladder and the highlight surface on a 1080 by 1920 canvas.

#### Scenario: The strip is wide and short

- **WHEN** the members box renders at its default scale on the vertical canvas
- **THEN** it spans about three quarters of the canvas width and occupies a small fraction of its height

#### Scenario: The strip stays legible when scaled

- **WHEN** the owner scales the members box down
- **THEN** the count and the call to action remain on one horizontal line each rather than wrapping into a stacked block

### Requirement: The count rises during the broadcast

The members box SHALL re-read the member total on the same polling cadence the other overlay boxes use, so a new member joining is visible on stream within seconds of their first message. The count SHALL use the member-count definition, so software and account-only memberships are absent from it.

#### Scenario: A new member moves the number

- **WHEN** a first-time chatter sends a message during a broadcast
- **THEN** the members box total increases on the next poll

#### Scenario: The bot never moves the number

- **WHEN** the delivery bot posts a message
- **THEN** the members box total is unchanged
