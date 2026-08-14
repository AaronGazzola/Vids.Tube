# member-count-overlay Specification

## Purpose
TBD - created by archiving change membership-loop. Update Purpose after archive.
## Requirements
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

### Requirement: The count rises during the broadcast

The members box SHALL re-read the member total on the same polling cadence the other overlay boxes use, so a new member joining is visible on stream within seconds of their first message. The count SHALL use the member-count definition, so software and account-only memberships are absent from it.

#### Scenario: A new member moves the number

- **WHEN** a first-time chatter sends a message during a broadcast
- **THEN** the members box total increases on the next poll

#### Scenario: The bot never moves the number

- **WHEN** the delivery bot posts a message
- **THEN** the members box total is unchanged

### Requirement: A single message does not cycle

The members box SHALL show a single configured message statically, with no transition and no timer, so a streamer who wants one sentence gets exactly the behaviour the strip had before cycling existed.

#### Scenario: One message is static

- **WHEN** exactly one message is configured
- **THEN** the strip shows it without animating and without advancing

#### Scenario: No messages behaves as one message

- **WHEN** no messages are configured
- **THEN** the strip shows the default sentence statically

### Requirement: The member count belongs to the first message

The members box SHALL show the member count alongside the first message only. While any later message is showing, the message SHALL take the full width of the strip, and the count SHALL return when the cycle returns to the first message.

#### Scenario: A later message takes the full width

- **WHEN** the strip is showing any message other than the first
- **THEN** no count is shown and the message occupies the full width of the strip

#### Scenario: The count returns with the first message

- **WHEN** the cycle returns to the first message
- **THEN** the count is shown beside it again, carrying the current total rather than the total from the previous cycle

### Requirement: Messages reach the overlay on the layout's own path

Configured messages SHALL be stored in the saved overlay layout and SHALL reach the live overlay by the same push and the same poll that carry a layout edit, so a message change appears in the broadcast on the same path and within the same time as moving a box.

#### Scenario: An edit reaches the broadcast promptly

- **WHEN** the streamer changes a message in the Settings tab
- **THEN** the live overlay shows the change without the overlay being reloaded

#### Scenario: A layout saved before messages existed is unharmed

- **WHEN** a layout saved before this change is loaded
- **THEN** every box keeps its saved position, scale, toggle and opacity, and the strip shows the default sentence

### Requirement: The message banner replaces the subs goal box

The overlay layout SHALL offer a members box in place of the subs goal box. The members box SHALL be positionable, scalable, toggleable and opacity-adjustable exactly as the other overlay boxes are, and SHALL be saved in the same overlay layout as the rest.

The saved layout version SHALL be bumped so the members box does not inherit the subs box's coordinates. Bumping the version SHALL NOT discard the positions of any other box.

The likes goal and the viewers goal SHALL be unchanged.

#### Scenario: The subs box is gone

- **WHEN** the owner opens the overlay layout editor
- **THEN** no subs goal box is offered, and a members box is offered in its place

#### Scenario: The other goals survive

- **WHEN** the members box is added
- **THEN** the likes goal and viewers goal boxes render and behave as before

### Requirement: The message banner shows the count and the call to action

The members box SHALL sit on the same translucent black backing the other overlay surfaces use, scaled by the opacity control, inside a one-pixel white border with rounded corners, so the strip holds its edge against any picture behind it.

The box SHALL NOT apply a backdrop blur. Blurring what sits behind reads as a solid panel however far the opacity control is wound down, which defeats the control rather than obeying it.

Along its left it SHALL read the message currently showing, on a single line that never wraps. Where the streamer has written no messages, that message SHALL be "Chat to become a member at Vids.Tube!", so a channel that never configures anything is unchanged.

Down its right, while the first message is showing, it SHALL place the site's own mark beside the member total. The mark carries the meaning a written label used to: the site's logo beside a figure says what is being counted without spending a word on it, on a strip whose width is the scarce thing. The mark SHALL be pinned to its dark-mode form in both themes, because an overlay sits on a broadcast rather than on a page and must not follow the owner's light or dark preference.

Nothing else SHALL appear on the strip. Neither a second line of instructions nor the site's own name in words belongs there: the message already says what to do, and the count says how many have done it.

#### Scenario: The box states how to join

- **WHEN** the members box renders during a broadcast with no messages configured
- **THEN** its left reads "Chat to become a member at Vids.Tube!" on one unbroken line

#### Scenario: The right-hand side is the count and the site's mark

- **WHEN** the members box renders while the first message is showing
- **THEN** the site's mark sits beside the member total, and nothing else appears beside them

#### Scenario: The strip is bordered

- **WHEN** the members box renders
- **THEN** it carries a one-pixel white border with rounded corners

#### Scenario: The broadcast shows through when the control is low

- **WHEN** the opacity control for the members box is set low
- **THEN** what is behind the strip is visible through it unblurred

#### Scenario: Nothing extra is carried

- **WHEN** the members box renders
- **THEN** no "See your stats" line appears on it

### Requirement: The message banner is a thin horizontal strip

The members box SHALL be laid out as a thin horizontal strip spanning about three quarters of the width of the 1080-wide vertical broadcast canvas, with the count and the call to action arranged along its length rather than stacked into a block.

The strip SHALL be compact in height, because it competes for vertical space with the goals, the competition ladder and the highlight surface on a 1080 by 1920 canvas.

#### Scenario: The strip is wide and short

- **WHEN** the members box renders at its default scale on the vertical canvas
- **THEN** it spans about three quarters of the canvas width and occupies a small fraction of its height

#### Scenario: The strip stays legible when scaled

- **WHEN** the owner scales the members box down
- **THEN** the count and the call to action remain on one horizontal line each rather than wrapping into a stacked block

### Requirement: The message banner cycles through the streamer's messages

The members box SHALL cycle through the messages the streamer has configured, showing each in turn for the same fixed dwell. The transition SHALL move the strip's contents downward, so the message showing leaves at the bottom of the strip while the next arrives from above. The cycle SHALL return to the first message after the last.

#### Scenario: Several messages take turns

- **WHEN** more than one message is configured and a broadcast is running
- **THEN** each message is shown in turn, in the order the streamer set, and the order repeats

#### Scenario: The transition scrolls downward

- **WHEN** the strip advances from one message to the next
- **THEN** the message showing moves downward out of the strip and the next enters from above

#### Scenario: The strip keeps its height and never wraps

- **WHEN** the strip advances between messages of different lengths
- **THEN** the strip's height is unchanged and no message wraps onto a second line

### Requirement: The overlay is named the message banner

The overlay SHALL be called the "message banner" wherever it is named: in the overlay control
panel, in the Settings tab, in the stored layout key, and in the test identifiers the browser
specs read. The former name, "members", SHALL NOT remain in any of those places.

#### Scenario: The owner sees one name

- **WHEN** the owner opens the Overlays tab and the Settings tab
- **THEN** the overlay is called the message banner in both, and nowhere is it called members

### Requirement: Saved layouts are migrated to the new key

A migration SHALL move the overlay's entries in each saved layout's `boxes`, `visible` and
`boxOpacity` from the `members` key to the `messageBanner` key, preserving position, scale,
visibility and opacity exactly. The migration SHALL be idempotent, SHALL leave a layout that
already carries the new key untouched, and SHALL disturb no other overlay's entries.

#### Scenario: An existing layout keeps its position

- **WHEN** a saved layout positions the overlay away from its default and the migration runs
- **THEN** the overlay is stored under the new key with the same position, scale, visibility and
  opacity, and renders exactly where it did before

#### Scenario: Running twice changes nothing

- **WHEN** the migration is applied a second time
- **THEN** every saved layout is unchanged

#### Scenario: Other overlays are untouched

- **WHEN** the migration runs against a layout carrying every overlay
- **THEN** only the message banner's entries move, and every other overlay keeps its position,
  scale, visibility and opacity

### Requirement: One default message

The default layout SHALL carry exactly one message, "Chat to become a member at Vids.Tube!".
No further message SHALL be seeded.

#### Scenario: A fresh layout has one message

- **WHEN** a channel with no saved layout is loaded
- **THEN** the message banner carries exactly one message, the call to action, beside the count

