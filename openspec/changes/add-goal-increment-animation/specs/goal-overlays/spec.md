## ADDED Requirements

### Requirement: A goal overlay marks a rise in its metric

A goal overlay SHALL play an animation when the value it shows rises above the value it was last showing.

The animation SHALL be driven by the value changing, not by a refresh completing. A refresh reporting an
unchanged value SHALL animate nothing, and a value that falls SHALL animate nothing.

The animation SHALL play once per rise, however large the rise, and SHALL NOT queue or repeat.

#### Scenario: A subscriber arrives

- **GIVEN** a subscriber goal overlay showing a number
- **WHEN** the polled value comes back one higher
- **THEN** the overlay plays its animation once

#### Scenario: A poll that changes nothing

- **GIVEN** a goal overlay showing a number
- **WHEN** the polled value comes back the same
- **THEN** nothing animates

#### Scenario: A value that falls

- **GIVEN** a viewer goal overlay showing a number
- **WHEN** the polled value comes back lower, as viewers leave
- **THEN** nothing animates

#### Scenario: A jump of several

- **WHEN** the value rises by more than one between polls
- **THEN** the animation plays exactly once, not once per unit

### Requirement: The first value shown is not a rise

A goal overlay SHALL NOT animate the first value it shows. Arriving at a number from nothing is not a
rise, and animating it would make every page load, every OBS source refresh and every reconnect look like
a celebration.

#### Scenario: The overlay loads

- **WHEN** a goal overlay renders its first value
- **THEN** nothing animates

#### Scenario: The browser source is refreshed mid-broadcast

- **GIVEN** a broadcast with a subscriber count well above zero
- **WHEN** the OBS browser source is refreshed
- **THEN** the overlay shows the current number without animating it

### Requirement: Arranging a layout does not animate

A goal overlay SHALL NOT animate while the Overlays tab is in its resize-and-reposition mode, so that
moving and scaling boxes stays legible.

Outside that mode the Overlays tab SHALL animate exactly as the broadcast does, so the streamer can see
what the audience will see.

#### Scenario: Dragging a box

- **GIVEN** the Overlays tab is in resize-and-reposition mode
- **WHEN** a goal metric rises
- **THEN** nothing animates

#### Scenario: Watching the composer normally

- **GIVEN** the Overlays tab is not in resize-and-reposition mode
- **WHEN** a goal metric rises
- **THEN** the overlay animates as it does on the broadcast

### Requirement: The animation reads at broadcast scale

The animation SHALL be sized relative to the goal overlay's own drawn size, so that it reads on a
1080x1920 canvas at the scale the streamer set rather than only in a desktop-sized preview.

The animation SHALL be composited transform and opacity only, so that OBS captures a moved layer rather
than a relayout at the broadcast frame rate.

The animation SHALL NOT change the space the overlay occupies, so a box positioned against a live picture
does not shift while it plays.

#### Scenario: A scaled-up goal

- **GIVEN** a goal overlay whose box is scaled to twice its base size
- **WHEN** its metric rises
- **THEN** the animation is drawn proportionally to the overlay at that size

#### Scenario: Neighbouring boxes hold still

- **WHEN** a goal overlay animates
- **THEN** no other overlay moves, and the animating overlay occupies the same space throughout
