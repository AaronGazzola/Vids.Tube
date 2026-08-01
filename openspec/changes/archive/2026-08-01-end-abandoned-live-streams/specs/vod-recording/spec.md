# vod-recording Specification (delta)

## MODIFIED Requirements

### Requirement: Finalize on End, not on disconnect

The system SHALL finalize the VOD when the broadcast ends, not on encoder
disconnect. The processing VOD row created at go-live SHALL become visible
(ready) only once the stream is `ended`; a disconnect that is later reconnected
SHALL NOT publish a partial VOD. A broadcast that is ended automatically as
abandoned (see `stream-lifecycle`) SHALL publish its VOD the same way an
owner-pressed End does, so a forgotten End can never strand a finalized
recording in `processing` indefinitely. When the abandoned broadcast has no
`mp4_path` — the finalize never landed — the stuck-row reaper retains sole
ownership of the decision to mark it `failed`.

#### Scenario: Disconnect alone does not publish a VOD

- **WHEN** the encoder disconnects mid-broadcast and the owner has not pressed End
- **THEN** no VOD is published; the broadcast remains `live` in a disconnected state

#### Scenario: End publishes the concatenated VOD

- **WHEN** the owner presses End after the encoder has disconnected
- **THEN** the segments since `live_at` are concatenated, uploaded, and the VOD row
  flips to ready

#### Scenario: Abandoned broadcast publishes its finalized recording

- **WHEN** a broadcast is ended automatically as abandoned and its VOD row is
  `processing` with an `mp4_path` already recorded by the finalize hook
- **THEN** that VOD flips to `ready` with `published_at` stamped

#### Scenario: Abandoned broadcast with no recording is left to the reaper

- **WHEN** a broadcast is ended automatically as abandoned and its VOD row is
  `processing` with no `mp4_path`
- **THEN** the automatic end does not publish or fail it; the stuck-row reaper
  resolves it once the stream has been `ended` beyond the reap window
