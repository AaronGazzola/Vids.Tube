# live-overlays-tab Specification

## Purpose
TBD - created by archiving change redesign-live-overlays-tab. Update Purpose after archive.
## Requirements
### Requirement: Overlays tab on the /live page

The system SHALL provide an Overlays tab on the `/live` page, placed between Preview and
Activity. The tab SHALL render the overlay stage — the still-frame slideshow, gradient or
black background with every visible overlay drawn over it — together with the overlay control
panel and its collapse button, both shown by default rather than revealed by any other
control. The tab SHALL be reachable without turning on demo.

#### Scenario: Overlays tab is its own destination

- **WHEN** the owner opens the Overlays tab with demo off
- **THEN** the background, the overlays and the overlay control panel are all shown, with no
  mode switch required to reach them

#### Scenario: Panel collapses and reopens

- **WHEN** the owner collapses the overlay control panel and reopens it
- **THEN** the stage resizes to match and the panel returns with its previous contents

### Requirement: Overlays render real current values

The Overlays tab SHALL render each overlay from the same components the public OBS overlay
route renders, bound to the current broadcast's real data. A single overlay renderer SHALL
serve both the OBS route and the Overlays tab, so the two cannot drift apart.

#### Scenario: Real values while live

- **WHEN** a broadcast is live with goals in progress, scored viewers and a promoted highlight
- **THEN** the Overlays tab shows those goal bars, those leaderboard entries and that
  highlight, matching what the OBS route renders

#### Scenario: Genuinely empty when nothing is live

- **WHEN** no broadcast is live, or a live broadcast has produced no data yet
- **THEN** each overlay renders in its real empty state, showing zero counts, no featured
  message and an empty leaderboard, without substituting demo values or values from an
  earlier broadcast

### Requirement: Resize and reposition mode

The Overlays tab SHALL provide a switch that shows or hides the resize and reposition
container for every overlay at once. The switch SHALL be off when the tab loads and SHALL be
session state, never written to the saved layout and never sent to OBS.

While the switch is off, no container SHALL be drawn and no overlay SHALL respond to dragging
or resizing. While it is on, every visible overlay SHALL display a clearly visible container
with a grab handle at each of its four corners.

#### Scenario: Off means immovable

- **WHEN** the switch is off and the owner drags an overlay or its corner
- **THEN** no container is visible and the overlay neither moves nor changes size

#### Scenario: On reveals every container

- **WHEN** the owner turns the switch on
- **THEN** every visible overlay shows a container with four corner handles

#### Scenario: Mode is not saved

- **WHEN** the owner turns the switch on, adjusts overlays, and reloads the page
- **THEN** the adjusted positions and sizes are kept while the switch is off again

### Requirement: Corner resizing preserves aspect ratio

Dragging any corner handle SHALL change the overlay's single uniform scale value, anchored so
that the opposite corner stays in place. The scale SHALL be clamped to the existing bounds.
Because one value drives both dimensions, an overlay SHALL never be stretched or distorted by
resizing.

#### Scenario: Opposite corner is the anchor

- **WHEN** the owner drags the bottom-right handle outward
- **THEN** the overlay grows about its top-left corner, which does not move

#### Scenario: Aspect ratio cannot be broken

- **WHEN** the owner drags any corner handle in any direction
- **THEN** the overlay's width and height change in the same proportion and its content is
  never stretched

#### Scenario: Repositioning still works

- **WHEN** the owner drags an overlay's container away from its corners
- **THEN** the overlay moves without changing size

### Requirement: Bitmap overlay content matches the rendered size

Bitmap content inside overlays, such as chatter avatars, SHALL be requested at a size derived
from the overlay's rendered pixel size multiplied by the device pixel ratio, rounded up to a
bucket, so that enlarging an overlay never shows a soft or upscaled image. During a drag the
bucket SHALL only increase, settling to the correct bucket when the drag ends.

#### Scenario: Enlarged overlay stays sharp

- **WHEN** an overlay containing avatars is scaled up substantially
- **THEN** the avatars are re-requested at a larger size and render sharply rather than
  upscaled

#### Scenario: No flicker while dragging

- **WHEN** the owner drags a corner inward and outward repeatedly
- **THEN** the avatar size bucket never decreases mid-drag, and settles once the drag ends

