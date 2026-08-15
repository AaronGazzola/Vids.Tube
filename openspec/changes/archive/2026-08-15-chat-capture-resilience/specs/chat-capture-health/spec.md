## ADDED Requirements

### Requirement: Chat capture reports that it is alive

While a broadcast is engaged, the system SHALL record on that broadcast the time of the most
recent successful YouTube chat page read. The recorded time SHALL reflect a successful read
rather than the arrival of a message, because a chat with nobody speaking is not a fault and must
not be reported as one.

The record SHALL be written no more often than once every 15 seconds, so a broadcast whose
polling interval is short does not incur a database write per second for no additional truth.

A broadcast with no YouTube video attached SHALL record nothing, since there is no chat to read.

#### Scenario: A working reader keeps its stamp fresh

- **WHEN** the poller reads a page successfully and more than 15 seconds have passed since the
  last stamp
- **THEN** the broadcast's last-read time is updated

#### Scenario: A quiet chat is still reported as alive

- **WHEN** pages are read successfully but carry no messages
- **THEN** the last-read time still advances, because the reader is working

#### Scenario: A stalled reader stops advancing

- **WHEN** page reads are failing
- **THEN** the last-read time stays where it was, and grows stale for as long as the failure lasts

### Requirement: A stalled reader is visible while the broadcast runs

The Settings tab of `/live` SHALL show, for a live broadcast with a YouTube video attached,
whether YouTube chat capture is currently working, derived from how long ago the broadcast last
recorded a successful read. Capture SHALL be presented as stalled once that gap exceeds a shared
staleness window, and the presentation SHALL make a stalled reader unmistakable rather than
requiring a number to be interpreted.

This SHALL be shown independently of worker availability. A worker that is running while its chat
reader is dead is the exact condition that went unnoticed on 9-Aug-2026, so the two SHALL NOT be
collapsed into one indicator.

#### Scenario: Capture is working

- **WHEN** a live broadcast recorded a successful read within the staleness window
- **THEN** the Settings tab shows YouTube chat capture as working

#### Scenario: Capture has stalled while the worker runs

- **WHEN** the worker heartbeat is fresh but the broadcast's last successful read is older than
  the staleness window
- **THEN** the Settings tab shows the worker as running and YouTube chat capture as stalled

#### Scenario: Nothing to report

- **WHEN** no broadcast is live, or the live broadcast has no YouTube video attached
- **THEN** no capture indicator is shown

### Requirement: A stored message records how it arrived

Every chat message SHALL record whether it was stored by live capture during the broadcast or
added afterwards from the platform's chat replay. Without it, a message added by the top-up is
indistinguishable from one captured live, and how much live capture actually achieved cannot be
answered for any broadcast that has been repaired.

Messages stored before this was recorded SHALL carry the live value, and any report reading the
column SHALL state that broadcasts repaired before this change overstate what live capture
achieved, rather than presenting their figures as sound.

#### Scenario: Live capture marks its own messages

- **WHEN** the worker stores a message read from live chat
- **THEN** the message records that it arrived from live capture

#### Scenario: The replay top-up marks what it adds

- **WHEN** the top-up inserts a message found in the chat replay and not already stored
- **THEN** the message records that it arrived from the replay

### Requirement: Chat completeness is measurable per broadcast

The system SHALL provide a report stating, for each broadcast carrying a YouTube video, how many
messages were captured live, how many the chat replay holds, and how many are stored once both
are accounted for. The report SHALL compute these figures from the stored chat and the archive
each time it runs rather than reading a saved figure, so it cannot disagree with the data.

The report SHALL identify a broadcast whose live capture holds materially fewer messages than the
replay, since that is the signature of a reader that stopped part-way. It SHALL also identify a
broadcast whose replay has not been fetched, so an absent archive is never mistaken for a
complete one.

The report SHALL NOT record whether a broadcast is settled or otherwise change what the
post-broadcast pass does.

#### Scenario: A broadcast that lost chat is identified

- **WHEN** the report runs over a broadcast whose replay holds materially more messages than live
  capture stored
- **THEN** that broadcast is listed with both figures and the shortfall between them

#### Scenario: An unfetched replay is not mistaken for a complete one

- **WHEN** the report runs over a broadcast whose chat replay has never been fetched
- **THEN** that broadcast is reported as having no archive to compare against, rather than as
  complete

#### Scenario: Repaired history is not presented as sound

- **WHEN** the report includes broadcasts repaired before messages recorded how they arrived
- **THEN** it states that their live-capture figures are overstated
