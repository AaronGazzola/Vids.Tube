## MODIFIED Requirements

### Requirement: The members box shows the count and the call to action

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

## ADDED Requirements

### Requirement: The strip cycles through the streamer's messages

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
