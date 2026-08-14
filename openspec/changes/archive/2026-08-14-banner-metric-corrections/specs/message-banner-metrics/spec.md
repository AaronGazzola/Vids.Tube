## RENAMED Requirements

- FROM: `### Requirement: An unavailable metric renders as nothing`
- TO: `### Requirement: An unavailable metric renders as a dash`

## MODIFIED Requirements

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

### Requirement: The metrics on offer

The metric control SHALL offer exactly these nine: total subs, new subs this stream, likes this
stream, current viewers, total unique chatters, chats this stream, chat commands this stream,
members, and new members this stream.

A metric named "this stream" SHALL be scoped to the live broadcast. A metric not so named SHALL
be the channel's lifetime figure.

Chat commands this stream SHALL count the commands actually used during the broadcast, not the
commands the channel has available, and not every command the channel has ever seen. Chats this
stream SHALL count the messages sent during the broadcast, from every origin the chat carries.

Total subs SHALL additionally require a live broadcast, despite being a lifetime figure, because
the subscriber count is read from YouTube as part of the goal poll. Polling YouTube while nothing
is live would spend the daily quota to show a banner nobody is watching, and quota is the scarce
resource. Members and total unique chatters come from the database and SHALL show at any time.

#### Scenario: A per-stream metric counts only this broadcast

- **WHEN** a message carries new subs this stream
- **THEN** the number shown is the gain since this broadcast started, not the channel total

#### Scenario: Commands are counted as they are used

- **WHEN** a viewer uses a command during the broadcast
- **THEN** the chat commands this stream figure rises by one

#### Scenario: Chats are counted as they are sent

- **WHEN** messages are sent during the broadcast
- **THEN** the chats this stream figure counts them, whichever chat they came from

#### Scenario: A lifetime metric ignores the broadcast

- **WHEN** a message carries total unique chatters
- **THEN** the number shown counts every chatter the channel has had, not only tonight's

#### Scenario: A retired metric degrades rather than changing meaning

- **WHEN** a saved message carries the former lifetime chat commands kind
- **THEN** the message keeps its words and carries no metric, rather than quietly showing a
  per-broadcast figure in its place
