# live-connection-state Specification

## Purpose

Present an encoder drop during a live broadcast as a recoverable Disconnected state —
on the public player, the owner preview, and the End-stream guard — so a stale feed
is never mistaken for an ended stream and chat stays open across reconnects.

## Requirements

### Requirement: Disconnected live state

The system SHALL, when a broadcast is `live` but its feed is stale (`last_seen_at`
older than the staleness threshold), present a **Disconnected** state on the public
player and the owner preview — an overlay such as "Disconnected — waiting for the
stream to resume" over the last frame or a placeholder — rather than a frozen,
blank, or errored player, and SHALL NOT treat the stream as ended. Live chat SHALL
remain mounted and writable throughout. When the feed returns, playback SHALL resume
automatically without a reload.

#### Scenario: Encoder drops mid-broadcast

- **WHEN** the encoder disconnects while the broadcast is `live`
- **THEN** the player shows the Disconnected state, the stream is still live, and
  viewers can still read and post chat

#### Scenario: Stale live stream is not hidden as ended

- **WHEN** a `live` row's `last_seen_at` is stale
- **THEN** the public surface still shows the broadcast (Disconnected), not an ended
  or missing stream

#### Scenario: Reconnect resumes playback

- **WHEN** the encoder reconnects and the feed refreshes
- **THEN** the Disconnected overlay clears and playback resumes on the same stream
  with the same chat

### Requirement: End-stream connection guard

The system SHALL guard the `/live` End action so it cannot end a broadcast while the
encoder is still connected (fresh `last_seen_at`). Pressing End while connected SHALL
show a dialog instructing the owner to stop the stream in the encoder first and try
again, and SHALL NOT end the broadcast. Once the feed is disconnected, End SHALL
proceed through its normal confirmation.

#### Scenario: End blocked while connected

- **WHEN** the owner presses End stream while the encoder is still connected
- **THEN** a dialog tells them to stop the stream in OBS first and the broadcast is
  not ended

#### Scenario: End allowed after disconnect

- **WHEN** the owner presses End stream after the encoder has disconnected
- **THEN** the normal End confirmation is shown and, on confirm, the broadcast ends
  and the VOD is finalized
