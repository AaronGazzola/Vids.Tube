## ADDED Requirements

### Requirement: Three renditions are published for a live broadcast

While a broadcast is publishing and the ladder is enabled, the streaming machine SHALL make
three renditions available: the publisher's own stream unchanged, a 720x1280 rendition at
approximately 2.5 Mbps, and a 540x960 rendition at approximately 1.2 Mbps. The publisher's
stream SHALL NOT be re-encoded.

#### Scenario: Renditions available during a broadcast

- **WHEN** an encoder is publishing to a channel's path
- **THEN** the channel's three rendition playlists each serve segments that advance

#### Scenario: Top rendition is the publisher's own stream

- **WHEN** the top rendition's segments are inspected
- **THEN** their resolution, frame rate and bitrate match what the encoder sent, and no
  re-encode has taken place

### Requirement: Renditions are produced by one packager

Every rendition SHALL be produced by a single process writing a single output, so that all
three share one timeline. No rendition SHALL be republished into the streaming server, and
no rendition SHALL be packaged separately from the others.

#### Scenario: A single transcoder produces every rendition

- **WHEN** the transcoder is running for a broadcast
- **THEN** exactly one transcoding process is running for that broadcast, and it writes all
  three renditions

#### Scenario: No rendition is published back into the streaming server

- **WHEN** the streaming server's paths are inspected during a broadcast
- **THEN** only the encoder's own path is publishing, and no rendition path exists

### Requirement: Renditions are interchangeable

Every rendition SHALL carry byte-identical audio, and SHALL start its segments at the same
instants as every other rendition, so that a player switching rendition mid-playback
neither moves in time nor interrupts the audio.

#### Scenario: Audio is copied, not re-encoded

- **WHEN** the audio stream of a lower rendition is compared with the top rendition's
- **THEN** the codec, sample rate and channel layout are identical and the audio has not
  been re-encoded

#### Scenario: Segment boundaries align across renditions

- **WHEN** the three playlists are read at the same moment
- **THEN** their segments cover the same time boundaries, and no rendition carries an extra
  keyframe the others do not

#### Scenario: Keyframe cadence follows the publisher

- **WHEN** the publisher's keyframe interval is measured from the live stream
- **THEN** each transcoded rendition uses that same interval, with scene-cut keyframes
  disabled

#### Scenario: A cadence that cannot align is refused

- **WHEN** the measured keyframe interval is not a whole multiple of the segment duration
- **THEN** the measurement fails, naming both numbers, rather than producing renditions
  that cannot align

### Requirement: Renditions are advertised as one master playlist

The streaming machine SHALL serve a master playlist per channel that advertises the three
renditions, each with its bandwidth, resolution and codecs, ordered from lowest bandwidth
to highest. The master playlist SHALL address each rendition relative to itself, and SHALL
NOT depend on any per-viewer token.

#### Scenario: Master playlist lists three renditions

- **WHEN** the master playlist for a channel is fetched
- **THEN** it advertises exactly three renditions with distinct bandwidths and resolutions,
  lowest bandwidth first

#### Scenario: Every advertised rendition resolves

- **WHEN** a player loads the master playlist during a broadcast
- **THEN** each advertised rendition resolves to a playlist that serves segments

#### Scenario: Single-rendition address keeps working

- **WHEN** the channel's own playlist address is fetched directly, as broadcasts from
  before this change record it
- **THEN** it serves the top rendition from the streaming server exactly as it did before

### Requirement: A partly written file is never served

Segments and playlists SHALL be written under a temporary name and renamed into place, so
that a viewer fetching a file while the transcoder is writing it receives either the
complete previous file or the complete new one.

#### Scenario: A segment is fetched while it is being written

- **WHEN** a segment is requested at the moment the transcoder is writing that segment
- **THEN** the response is a complete file, never a truncated one

### Requirement: Rendition work follows the publish lifecycle

Transcoding SHALL start when an encoder connects to a channel and stop when it disconnects,
so that a machine with no broadcast on it performs no transcoding. A broadcast's rendition
files SHALL be removed when the broadcast's encoder disconnects.

#### Scenario: Idle machine does no transcoding

- **WHEN** no encoder is publishing
- **THEN** no transcoder process is running

#### Scenario: Transcoding stops when the encoder disconnects

- **WHEN** the encoder disconnects
- **THEN** the transcoder stops and the rendition playlists stop being served

#### Scenario: A stale manifest does not outlive its broadcast

- **WHEN** a broadcast has ended
- **THEN** the master playlist and rendition playlists from that broadcast are no longer
  served

#### Scenario: A failed transcoder is restarted

- **WHEN** the transcoder's encoding process exits while the encoder is still publishing
- **THEN** it is started again, and the renditions resume

#### Scenario: Recording captures the publisher's stream

- **WHEN** a broadcast is recorded for its VOD
- **THEN** the recording is taken from the publisher's own stream and carries no transcode
  loss

### Requirement: The ladder is on by default and switchable on the streaming machine alone

The ladder SHALL run by default wherever the streaming machine can produce one, and SHALL
be disabled only by an explicit setting on that machine. Enabling or disabling it SHALL NOT
require a change to the application. While the ladder is off, viewers SHALL receive exactly
the playback they received before this change.

#### Scenario: Ladder on by default

- **WHEN** a broadcast starts on a machine carrying the transcoder and the channel's master
  playlist, with nothing further configured
- **THEN** the renditions are produced and the broadcast records the master playlist address

#### Scenario: Ladder explicitly disabled

- **WHEN** a broadcast starts on a machine where the ladder has been explicitly disabled
- **THEN** no transcoding happens, the broadcast records the single-rendition address, and
  playback is exactly as it was before this change, with no application deploy

### Requirement: A broadcast is only handed a ladder that exists

The streaming machine SHALL report a ladder to the application only while the renditions
are actually being produced, and SHALL re-report on every heartbeat rather than once at
go-live, so that a broadcast's recorded playback address follows what the machine is really
serving.

#### Scenario: The transcoder never started

- **WHEN** a broadcast starts and the transcoder refuses to run, for instance because the
  channel has no master playlist
- **THEN** no ladder is reported and the broadcast records the single-rendition address

#### Scenario: The transcoder dies for good mid-broadcast

- **WHEN** the transcoder stops during a broadcast and does not come back
- **THEN** the next heartbeat reports no ladder, and the broadcast's recorded address
  returns to the single rendition rather than pointing at a manifest that has stopped
