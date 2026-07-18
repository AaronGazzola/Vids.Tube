## ADDED Requirements

### Requirement: Mobile layout switch

The system SHALL provide a single all-or-nothing Mobile layout switch that shows or
hides the representational YouTube-mobile chrome over the preview. The switch SHALL be
available both on the real Preview tab (a floating control over the player) and in the
demo overlay stage's control panel, and turning it off from either place SHALL hide the
chrome in both. The state SHALL persist per channel in the demo layout config and SHALL
be restored across sessions in both modes.

#### Scenario: Toggle from the real preview

- **WHEN** the owner turns the Mobile layout switch on over the real preview player
- **THEN** the mobile chrome renders over/around the video, and the same switch state
  is reflected in the demo stage's control panel

#### Scenario: Toggle off from the demo stage

- **WHEN** the owner turns the Mobile layout switch off in the demo stage control panel
- **THEN** the chrome disappears from the demo stage and from the real Preview tab

#### Scenario: State persists

- **WHEN** the owner enables Mobile layout and reloads the page
- **THEN** the chrome is shown again without re-toggling, in whichever mode the
  preview renders

### Requirement: Representational mobile chrome contents

When the Mobile layout switch is on, the system SHALL render a representational
YouTube-mobile chrome matching the reference screenshot's scale, position, and opacity
relative to the video: a channel top bar above the video (back arrow, channel avatar,
channel handle, red live dot with viewer count, like count, white Subscribe pill,
three-dot menu), overlaid live chat rows with avatars, member badges, handles, and
message text on the lower video, the live-chat welcome notice line, a circular heart
reaction button at the bottom right, and a "Chat…" input row straddling the bottom
video edge with most of its height below the video. All elements SHALL be
representational only — static sample content, no live data, no interactivity — except
that the top bar SHALL use the channel's real handle and avatar. Sample chat authors
SHALL be invented, never real users. All dimensions SHALL derive from a single set of
reference constants scaled by the rendered video width.

#### Scenario: Chrome renders to scale

- **WHEN** the chrome is shown over a vertical video at any rendered size
- **THEN** every element's size and position scales proportionally with the video
  width, matching the reference screenshot's layout

#### Scenario: Chrome is inert

- **WHEN** the owner clicks or drags on chrome elements in the real preview
- **THEN** nothing happens — the chrome captures no pointer events aimed at the
  underlying page

### Requirement: Anchoring in the real Preview tab

On the real Preview tab, the chrome SHALL anchor to the rendered video element's rect:
the top bar directly above the video's top edge, on-video elements within the video
rect, and the input row overlapping the bottom edge by about a quarter of its height.
The player container SHALL make vertical room for the out-of-video elements rather than
clipping them. The chrome SHALL render only when the video is portrait; while the
stream is landscape the switch SHALL be disabled with a hint that the mobile layout
applies to vertical streams only.

#### Scenario: Vertical stream in the real preview

- **WHEN** Mobile layout is on and the real preview plays a portrait stream
- **THEN** the chrome renders anchored to the video rect with the top bar above the
  video and the input row straddling its bottom edge, unclipped

#### Scenario: Landscape stream

- **WHEN** the real preview plays a landscape stream
- **THEN** no chrome renders and the Mobile layout switch is disabled with a
  vertical-streams-only hint

### Requirement: Anchoring in the demo stage

In the demo overlay stage, the chrome SHALL anchor to the centered 9:16 video area.
When the switch is on, the stage SHALL uniformly scale the entire stream content
(background and all overlays together) just enough to fit the top bar above and the
input protrusion below the video area, preserving every overlay's position relative to
the video so the collision preview stays truthful. Turning the switch off SHALL restore
the unscaled stage exactly.

#### Scenario: Demo stage makes room without distorting layout

- **WHEN** Mobile layout is turned on in the demo stage
- **THEN** the stream content scales down uniformly, the chrome renders around the
  video area, and each overlay keeps its position relative to the video content

#### Scenario: Overlay collision check

- **WHEN** an overlay box sits in the region covered by the mobile chat rows or input
- **THEN** the owner can see the overlap directly and drag the overlay clear of it

#### Scenario: Demo stage restored

- **WHEN** Mobile layout is turned off in the demo stage
- **THEN** the stage renders exactly as before the toggle, unscaled
