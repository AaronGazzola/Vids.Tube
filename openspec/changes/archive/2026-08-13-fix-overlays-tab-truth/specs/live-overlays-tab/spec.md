## MODIFIED Requirements

### Requirement: Overlays render real current values

The Overlays tab SHALL render each overlay from the same components the public OBS overlay
route renders, bound to the current broadcast's real data. A single overlay renderer SHALL
serve both the OBS route and the Overlays tab, so the two cannot drift apart.

An overlay whose value is absent, zero or empty SHALL still be rendered on the Overlays tab,
in that empty form, rather than omitted. The OBS route SHALL continue to render nothing for
such an overlay, so the audience never sees an empty frame.

Goal bars SHALL be drawn against the goal targets saved on the Settings tab, on both surfaces,
falling back to the built-in defaults only when no targets are saved.

#### Scenario: Real values while live

- **WHEN** a broadcast is live with goals in progress, scored viewers and a promoted highlight
- **THEN** the Overlays tab shows those goal bars, those leaderboard entries and that
  highlight, matching what the OBS route renders

#### Scenario: Empty overlays stay on the stage

- **WHEN** no broadcast is live and the Overlays tab is opened
- **THEN** the goal bars render at zero against the saved targets, and the leaderboard is
  present on the stage rather than omitted from it, drawing nothing because it is empty and
  becoming positionable once resize mode is on

#### Scenario: The audience sees nothing instead of an empty frame

- **WHEN** no broadcast is live
- **THEN** the OBS route renders no leaderboard at all

#### Scenario: Idle goal bars use the owner's targets

- **WHEN** goal targets are saved on the Settings tab and no broadcast is live
- **THEN** the goal bars on both surfaces show zero against those saved targets rather than
  against the built-in defaults

### Requirement: Resize and reposition mode

The Overlays tab SHALL provide a switch that shows or hides the resize and reposition
container for every overlay at once. The switch SHALL be off when the tab loads and SHALL be
session state, never written to the saved layout and never sent to OBS.

While the switch is off, no container SHALL be drawn and no overlay SHALL respond to dragging
or resizing. While it is on, every visible overlay SHALL display a clearly visible container
with a grab handle at each of its four corners.

An overlay that is currently rendering nothing SHALL still be given a container of at least a
minimum size while the switch is on, so it can be positioned. The minimum SHALL apply only to
a container that would otherwise have no size, so a rendered overlay is never resized by it.

#### Scenario: Off means immovable

- **WHEN** the switch is off and the owner drags an overlay or its corner
- **THEN** no container is visible and the overlay neither moves nor changes size

#### Scenario: On reveals every container

- **WHEN** the owner turns the switch on
- **THEN** every visible overlay shows a container with four corner handles

#### Scenario: An empty overlay can still be positioned

- **WHEN** the switch is on and no broadcast is live
- **THEN** the highlight slot and the break card each show a labelled container of at least the
  minimum size, and both can be dragged

#### Scenario: Mode is not saved

- **WHEN** the owner turns the switch on, adjusts overlays, and reloads the page
- **THEN** the adjusted positions and sizes are kept while the switch is off again

## ADDED Requirements

### Requirement: Event-driven overlays are idle-invisible

The highlight slot and the break card SHALL render nothing when idle, on both the Overlays tab
and the OBS route, because neither has a meaningful resting state. The dashed placeholder for
the highlight slot SHALL appear only while resize and reposition mode is on.

#### Scenario: No placeholder during normal composition

- **WHEN** the Overlays tab is open with resize mode off and nothing playing through the
  highlight slot
- **THEN** no dashed placeholder is shown and the slot occupies no space

#### Scenario: Placeholder returns for positioning

- **WHEN** the owner turns resize mode on with nothing playing through the highlight slot
- **THEN** the slot shows its labelled container so it can be positioned

### Requirement: The overlay panel is toggled from the tab row

The overlay control panel SHALL be shown and hidden by an icon button placed to the right of
the tab list, which SHALL carry a visibly active state while the panel is open. No button for
opening the panel SHALL be drawn on the stage itself.

#### Scenario: Toggling from the header

- **WHEN** the owner clicks the panel icon beside the tabs
- **THEN** the panel hides if it was open and shows if it was hidden, and the icon reflects
  which state it is in

#### Scenario: Nothing floats over the stage

- **WHEN** the panel is hidden
- **THEN** no button to reopen it is drawn over the overlays
