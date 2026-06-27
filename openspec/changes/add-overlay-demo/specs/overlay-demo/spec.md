## ADDED Requirements

### Requirement: Owner-only demo stage over a past VOD

The system SHALL provide an owner-guarded page at `/studio/demo` that plays one of the
owner's ready VODs as a backdrop and lays the real overlay components on top. It SHALL
list the owner's `status='ready'` videos via an owner-checked action, let the owner
pick one from a dropdown, and play it with native video controls
(`vodAssetUrl(mp4_path)`). The page SHALL make no database writes and SHALL not involve
the worker or YouTube.

#### Scenario: Owner plays a past VOD under the overlays

- **WHEN** the owner opens `/studio/demo` and selects one of their videos
- **THEN** that VOD plays in the stage with the overlay surfaces rendered over it

#### Scenario: Non-owner cannot access the demo

- **WHEN** a non-owner visits `/studio/demo`
- **THEN** the studio owner guard redirects them away

### Requirement: Reposition and resize each overlay surface

The system SHALL let the owner drag and resize each of the three overlay surfaces
(Highlights, Goals, Competition) independently over the video, via a reusable
draggable/resizable wrapper, so they can dial in the layout they will recreate as OBS
Browser Sources. A reset-layout control SHALL restore default positions.

#### Scenario: Owner repositions and scales a surface

- **WHEN** the owner drags a surface and drags its resize handle
- **THEN** that surface moves and scales independently of the others

#### Scenario: Reset layout

- **WHEN** the owner clicks reset layout
- **THEN** the surfaces return to their default positions and scales

### Requirement: Simulate overlay events with the real components and math

The system SHALL render the real `FeaturedAvatar`, `GoalBar`, and `Plant` components
driven by client-side simulation (no DB), using the production mappings
(`computeGoalProgress`, `plantShape`, and the avatar ring count). A control panel SHALL
let the owner: feature a viewer (animating their avatar with the correct ring count),
raise/lower a viewer's score (growing/shrinking their plant), and set the goal current
counts and targets with a Start action that snapshots the baseline as production does.
Both a Vids.Tube-style and a YouTube-style participant SHALL be representable so both
avatar render paths are visible.

#### Scenario: Feature a viewer animates a highlight

- **WHEN** the owner features a simulated viewer
- **THEN** that viewer's avatar animates across the highlights surface with rings equal
  to their simulated feature count

#### Scenario: Score changes grow the plant

- **WHEN** the owner raises a simulated viewer's score
- **THEN** that viewer's plant grows (via `plantShape`) relative to the leader

#### Scenario: Goal counts drive the bars

- **WHEN** the owner sets current counts and targets and presses Start
- **THEN** the goal bars reflect `computeGoalProgress` from the snapshot baseline, and
  reaching a target shows the rainbow state

#### Scenario: Both author origins render

- **WHEN** the roster includes a Vids.Tube-style handle and a YouTube-style name
- **THEN** the Vids.Tube participant renders with a channel-style avatar and the YouTube
  participant with its avatar URL

### Requirement: Demo verifies visuals, not AI decisions

The demo SHALL be limited to verifying overlay rendering, layout, and animation; it
SHALL NOT claim to validate the AI scoring decisions, which still require a live run.

#### Scenario: Scope is rendering and layout

- **WHEN** the owner uses the demo
- **THEN** it confirms how the overlays look and animate and where they sit, but not
  whether the model would pick those messages or scores
