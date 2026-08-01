# stream-lifecycle Specification (delta)

## ADDED Requirements

### Requirement: Abandoned live broadcasts are ended automatically

The system SHALL end a `live` broadcast whose feed has been silent longer than
the abandonment window (2 hours since `last_seen_at`, falling back to
`started_at`), without owner action. Ending SHALL close any open reconnect gap,
set `status='ended'`, and set `ended_at` to the last confirmed feed time rather
than the time the sweep runs, so stream duration and `live_at`-anchored replay
math remain truthful. A broadcast with a `break_ends_at` in the future SHALL be
exempt until the abandonment window has also elapsed past `break_ends_at`. The
sweep SHALL run on a database schedule, not on request traffic, because an
abandoned broadcast is by definition one that has stopped generating ingest
heartbeats. The abandonment window SHALL be long enough that a normal
disconnect/reconnect never trips it.

#### Scenario: Owner never presses End

- **WHEN** a `live` broadcast's encoder has been disconnected for more than the
  abandonment window and the owner has not pressed End
- **THEN** the broadcast becomes `ended` with `ended_at` set to its last
  confirmed feed time, and its open reconnect gap is closed at that same instant

#### Scenario: Reconnect window is not disturbed

- **WHEN** the encoder disconnects and reconnects within the abandonment window
- **THEN** the broadcast is still `live` on the same stream id, the gap is closed
  by the reconnect, and no automatic end has occurred

#### Scenario: Declared break is exempt

- **WHEN** a `live` broadcast has a `break_ends_at` in the future and its feed has
  been silent longer than the abandonment window
- **THEN** the broadcast is not ended; it becomes eligible only once the
  abandonment window has elapsed past `break_ends_at`

#### Scenario: Abandoned broadcast releases the active slot

- **WHEN** an abandoned broadcast has been ended automatically and the encoder
  later connects
- **THEN** the connect starts a fresh session rather than resuming the abandoned
  one, because the channel no longer has an active `live` row
