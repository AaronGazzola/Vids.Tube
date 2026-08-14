## MODIFIED Requirements

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
