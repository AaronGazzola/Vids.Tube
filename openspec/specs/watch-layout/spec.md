# watch-layout Specification

## Purpose
TBD - created by archiving change unified-player-and-chat-layout. Update Purpose after archive.
## Requirements
### Requirement: Shared layout mode

The live-stream page and the VOD watch page SHALL share a layout mode of
`default` or `fullscreen`, provided through a watch-layout context alongside a
reference to the stage element. The player's fullscreen control SHALL act on the stage
element supplied by that context, not on the player's own container, so that content
composed beside the player is included in the fullscreen presentation.

#### Scenario: Entering fullscreen targets the stage

- **WHEN** a viewer activates the fullscreen control on either page
- **THEN** the stage element enters fullscreen and the layout mode becomes `fullscreen`

#### Scenario: Exiting fullscreen restores the default layout

- **WHEN** the viewer exits fullscreen by the control, by `Escape`, or by the browser
- **THEN** the layout mode returns to `default` and the page restores its two-column
  presentation

#### Scenario: Layout mode is per-page ephemeral state

- **WHEN** the viewer navigates away from the page and returns
- **THEN** the layout mode is `default` and no layout preference is persisted

### Requirement: Chat is bounded and scrollable at every breakpoint

The system SHALL render the chat panel on the live-stream page, and the chat replay
panel on the VOD watch page, inside a container with a definite height at every
viewport width, so that the message list scrolls within itself. Growth of the message
list SHALL NOT increase the height of the page. The panel SHALL NOT impose a minimum
height that can exceed the height available to it.

#### Scenario: Long chat below the large breakpoint

- **WHEN** a viewer at a viewport narrower than the large breakpoint loads a stream
  whose chat contains more messages than fit on screen
- **THEN** the message list scrolls within its own container and the page body does not
  grow

#### Scenario: Long chat at desktop widths

- **WHEN** a viewer at a desktop width loads a stream with a long chat
- **THEN** the message list scrolls within its own container and the page body does not
  grow

#### Scenario: VOD chat replay is bounded on the same terms

- **WHEN** a viewer opens a VOD with an expanded chat replay at any viewport width
- **THEN** the replay message list scrolls within its own container and the page body
  does not grow

#### Scenario: Messages arriving do not resize the page

- **WHEN** new messages arrive during live playback
- **THEN** the chat container's height is unchanged and only its scroll content grows

### Requirement: Chat height derives from the shared layout

The system SHALL derive the chat column's height from the shared layout row that both
columns occupy, at widths where the player and chat are presented as columns, so the
two columns terminate at the same vertical position. The chat height SHALL NOT be set
from a fixed viewport-relative constant.

#### Scenario: Columns end level on desktop

- **WHEN** a viewer at a desktop width views a live stream
- **THEN** the bottom edge of the chat panel aligns with the bottom edge of the player
  column

#### Scenario: Player size change reflows the chat

- **WHEN** the player's rendered height changes, such as when a portrait stream resolves
  its intrinsic dimensions
- **THEN** the chat column's height follows the shared row rather than remaining at a
  previous fixed height

### Requirement: Single-column stage fills the viewport

At widths where the player and chat stack vertically, the stage SHALL occupy the
viewport height using a dynamic viewport unit, with the player sized to its content and
the chat message list consuming the remaining space. The chat composer and the chat
header SHALL remain visible without scrolling the page.

#### Scenario: Composer stays reachable on a phone

- **WHEN** a viewer on a phone opens a live stream with a long chat
- **THEN** the composer is visible without scrolling the page, and only the message list
  scrolls

#### Scenario: Browser chrome collapse does not clip the composer

- **WHEN** the mobile browser's chrome collapses or expands during scrolling
- **THEN** the stage height follows the dynamic viewport and the composer remains fully
  visible

#### Scenario: Non-scrolling regions are excluded from the scroll area

- **WHEN** the chat panel renders its header, any banner above the message list, and the
  composer
- **THEN** those regions sit outside the scrolling message list and are never scrolled
  out of view

### Requirement: Sticky-bottom behaviour within the bounded container

With a bounded container in place, the chat SHALL follow new messages while the viewer
is at the bottom of the list, and SHALL stop following and offer a jump control when the
viewer has scrolled up. Activating the jump control SHALL return the list to the bottom
and resume following.

#### Scenario: Viewer at the bottom follows new messages

- **WHEN** a new message arrives while the message list is scrolled to the bottom
- **THEN** the list scrolls to reveal the new message

#### Scenario: Viewer scrolled up is not yanked

- **WHEN** a new message arrives while the viewer has scrolled up in the list
- **THEN** the scroll position is preserved and a jump-to-latest control appears

#### Scenario: Jump control returns to the bottom

- **WHEN** the viewer activates the jump-to-latest control
- **THEN** the list scrolls to the newest message, the control is dismissed, and
  following resumes

### Requirement: Chat overlays the video in fullscreen

In `fullscreen` mode the chat SHALL be rendered as an overlay above the video inside the
stage element, with a control to toggle its visibility. The overlay SHALL default to
visible on the live-stream page and hidden on the VOD watch page. The toggle state SHALL
apply for the duration of the fullscreen session and SHALL NOT be persisted. Entering or
leaving fullscreen SHALL NOT remount the chat.

#### Scenario: Live chat overlays fullscreen video

- **WHEN** a viewer enters fullscreen on the live-stream page
- **THEN** the chat renders as an overlay above the video with its messages readable and
  its composer usable

#### Scenario: VOD replay overlay starts hidden

- **WHEN** a viewer enters fullscreen on the VOD watch page with an expanded chat replay
- **THEN** the chat overlay is hidden and can be revealed with the toggle

#### Scenario: Chat is not remounted across the mode change

- **WHEN** a viewer enters and then exits fullscreen during a live stream
- **THEN** the chat retains its loaded messages, its scroll position, and its realtime
  subscription without reconnecting

#### Scenario: Overlay visibility is not persisted

- **WHEN** a viewer hides the chat overlay, exits fullscreen, and re-enters fullscreen
- **THEN** the overlay returns to its per-surface default

