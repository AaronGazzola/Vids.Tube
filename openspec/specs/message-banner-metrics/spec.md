# message-banner-metrics Specification

## Purpose
TBD - created by archiving change message-banner-metrics. Update Purpose after archive.
## Requirements
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

The metric control SHALL offer exactly these nine: total subs, new subs this stream, likes this
stream, current viewers, unique chatters this stream, chats this stream, chat commands this
stream, members, and new members this stream.

A metric named "this stream" SHALL be scoped to the live broadcast. A metric not so named SHALL
be the channel's lifetime figure.

Unique chatters this stream SHALL count the different people who have spoken during the
broadcast, identified as the rest of the app identifies a participant: the signed-in user where
there is one, otherwise the origin and external author together. It SHALL be counted from the
chat itself rather than from an aggregate, so it is true while the broadcast is running.

Chat commands this stream SHALL count the commands actually used during the broadcast, not the
commands the channel has available. Chats this stream SHALL count the messages sent during the
broadcast, from every origin the chat carries.

Total subs SHALL additionally require a live broadcast, despite being a lifetime figure, because
the subscriber count is read from YouTube as part of the goal poll. Polling YouTube while nothing
is live would spend the daily quota to show a banner nobody is watching, and quota is the scarce
resource. Members comes from the database and SHALL show at any time.

#### Scenario: A per-stream metric counts only this broadcast

- **WHEN** a message carries new subs this stream
- **THEN** the number shown is the gain since this broadcast started, not the channel total

#### Scenario: Chatters are counted as they speak

- **WHEN** someone speaks for the first time during the broadcast
- **THEN** the unique chatters this stream figure rises by one, and does not rise again when
  that person speaks a second time

#### Scenario: Chatters off air

- **WHEN** no broadcast is live and a message carries unique chatters this stream
- **THEN** a dash is shown, because the figure describes a broadcast and there is none

#### Scenario: Commands are counted as they are used

- **WHEN** a viewer uses a command during the broadcast
- **THEN** the chat commands this stream figure rises by one

#### Scenario: Chats are counted as they are sent

- **WHEN** messages are sent during the broadcast
- **THEN** the chats this stream figure counts them, whichever chat they came from

#### Scenario: A retired metric degrades rather than changing meaning

- **WHEN** a saved message carries the former lifetime unique chatters kind
- **THEN** the message keeps its words and carries no metric, rather than quietly showing a
  per-broadcast figure in its place

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

### Requirement: An unavailable metric renders as a dash

A metric that cannot be resolved SHALL render a dash in place of its number, with its icon still
drawn, on both the broadcast and the Overlays tab. It SHALL NOT render as zero, because zero is
a claim, and it SHALL NOT disappear, because a metric that vanishes takes its space with it and
moves the layout the streamer arranged.

A metric cannot be resolved when it is a per-broadcast figure and no broadcast is live, or when
its count has not loaded.

#### Scenario: Off air, a per-broadcast metric shows a dash

- **WHEN** no broadcast is live and a message carries current viewers
- **THEN** the message shows its icon and a dash where the number would be, on both surfaces

#### Scenario: The layout does not move when a number arrives

- **WHEN** a metric resolves from unavailable to a number
- **THEN** the icon stays where it was and only the dash is replaced

#### Scenario: A database-backed lifetime metric still shows off air

- **WHEN** no broadcast is live and a message carries members
- **THEN** the member count is shown, because it does not depend on a broadcast

#### Scenario: Total subs waits for a broadcast

- **WHEN** no broadcast is live and a message carries total subs
- **THEN** a dash is shown, because the subscriber count is read from YouTube only while live

