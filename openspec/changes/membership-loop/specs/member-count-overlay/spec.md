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

The members box SHALL sit on the same translucent black backing the other overlay surfaces use, scaled by the opacity control, inside a one-pixel white border with rounded corners, so the strip holds its edge against any picture behind it.

The box SHALL NOT apply a backdrop blur. Blurring what sits behind reads as a solid panel however far the opacity control is wound down, which defeats the control rather than obeying it.

Along its left it SHALL read "Chat to become a member at Vids.Tube", on a single line that never wraps. Down its right it SHALL stack the member total above the label "Members".

The count and its label SHALL be sized close together: a bare number means nothing to someone seeing it for the first time, and it is the word beneath that turns a statistic into an invitation.

Nothing else SHALL appear on the strip. Neither a second line of instructions nor the site's own name belongs there: the call to action already says what to do, and the count says how many have done it.

#### Scenario: The box states how to join

- **WHEN** the members box renders during a broadcast
- **THEN** its left reads "Chat to become a member at Vids.Tube" on one unbroken line

#### Scenario: The right-hand side is the count and its label

- **WHEN** the members box renders
- **THEN** the member total sits above the label "Members", and nothing else appears beside them

#### Scenario: The strip is bordered

- **WHEN** the members box renders
- **THEN** it carries a one-pixel white border with rounded corners

#### Scenario: The broadcast shows through when the control is low

- **WHEN** the opacity control for the members box is set low
- **THEN** what is behind the strip is visible through it unblurred

#### Scenario: Nothing extra is carried

- **WHEN** the members box renders
- **THEN** no "See your stats" line appears on it

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
