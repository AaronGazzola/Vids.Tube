## ADDED Requirements

### Requirement: A banner message may carry one metric

Each message on the message banner SHALL be able to carry at most one metric, or none. The
settings tab SHALL provide, per message, a checkbox including or excluding a metric, and when
included, a control choosing which metric, a control choosing its icon, and a colour for that
icon.

#### Scenario: Adding a metric to a message

- **WHEN** the streamer ticks the metric checkbox on a message and chooses a metric and an icon
- **THEN** that message shows that number with that icon, on the banner and on the broadcast

#### Scenario: A message without a metric

- **WHEN** the metric checkbox is unticked
- **THEN** the message shows its text alone, with no number and no icon

#### Scenario: Metrics are per message

- **WHEN** two messages carry different metrics
- **THEN** each shows its own, as the banner cycles between them

### Requirement: The metrics on offer

The metric control SHALL offer exactly these eight: total subs, new subs this stream, likes this
stream, current viewers, total unique chatters, total chat commands, members, and new members
this stream.

A metric named "this stream" SHALL be scoped to the live broadcast. A metric not so named SHALL
be the channel's lifetime figure.

#### Scenario: A per-stream metric counts only this broadcast

- **WHEN** a message carries new subs this stream
- **THEN** the number shown is the gain since this broadcast started, not the channel total

#### Scenario: A lifetime metric ignores the broadcast

- **WHEN** a message carries total unique chatters
- **THEN** the number shown counts every chatter the channel has had, not only tonight's

### Requirement: An unavailable metric renders as nothing

A metric that cannot be resolved SHALL render as nothing at all, on both the broadcast and the
Overlays tab, and SHALL NOT render as zero, because zero is a claim and absence is the truth.
A metric cannot be resolved when it is a per-stream figure and no broadcast is live, or when its
count has not loaded.

#### Scenario: Off air, a per-stream metric is absent

- **WHEN** no broadcast is live and a message carries current viewers
- **THEN** the message shows its text alone, with no number and no icon, on both surfaces

#### Scenario: A lifetime metric still shows off air

- **WHEN** no broadcast is live and a message carries members
- **THEN** the member count is shown, because it does not depend on a broadcast

### Requirement: The icon is chosen from a fixed set

The icon control SHALL offer the Vids.Tube logo, the three goal icons for subs, likes and
viewers, and a curated set of extras. The chosen icon SHALL be stored as a name, and the colour
SHALL be stored with it.

#### Scenario: The icon and its colour reach the broadcast

- **WHEN** the streamer picks an icon and a colour for a message's metric
- **THEN** the broadcast draws that icon in that colour beside that message's number

#### Scenario: An unknown stored icon does not break the banner

- **WHEN** a saved message carries an icon name the current set does not contain
- **THEN** the message and its number still render, with the logo in place of the unknown icon

### Requirement: Colour is chosen with an in-page picker

Both the message text colour and the metric icon colour SHALL be chosen from an in-page picker
rather than the operating system's colour dialog, and the choice SHALL be applied once it is
settled rather than continuously while dragging.

#### Scenario: Picking a colour

- **WHEN** the streamer opens a colour control and chooses a colour
- **THEN** the picker is drawn in the page, and the message records one colour change rather
  than one per shade passed through
