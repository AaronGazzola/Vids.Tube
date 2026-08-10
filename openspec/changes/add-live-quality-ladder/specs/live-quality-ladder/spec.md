## ADDED Requirements

### Requirement: Three renditions are published for a live broadcast

While a broadcast is publishing, the streaming machine SHALL make three renditions
available: the publisher's own stream unchanged, a 720x1280 rendition at approximately
2.5 Mbps, and a 540x960 rendition at approximately 1.2 Mbps. The publisher's stream SHALL
NOT be re-encoded.

#### Scenario: Renditions available during a broadcast

- **WHEN** an encoder is publishing to a channel's path
- **THEN** the channel's own playlist, its 720x1280 playlist and its 540x960 playlist
  each serve segments that advance

#### Scenario: Top rendition is the publisher's own stream

- **WHEN** the top rendition's segments are inspected
- **THEN** their resolution, frame rate and bitrate match what the encoder sent, and no
  re-encode has taken place

### Requirement: Renditions are interchangeable

Every rendition SHALL carry byte-identical audio, and SHALL start its segments at the
same instants as every other rendition, so that a player switching rendition mid-playback
neither moves in time nor interrupts the audio.

#### Scenario: Audio is copied, not re-encoded

- **WHEN** the audio stream of a lower rendition is compared with the top rendition's
- **THEN** the codec, sample rate and channel layout are identical and the audio has not
  been re-encoded

#### Scenario: Segment boundaries align across renditions

- **WHEN** the three playlists are read at the same moment
- **THEN** their segments cover the same time boundaries, and no rendition carries an
  extra keyframe the others do not

#### Scenario: Keyframe cadence follows the publisher

- **WHEN** the publisher's keyframe interval is measured from the live stream
- **THEN** each transcoded rendition uses that same interval, with scene-cut keyframes
  disabled

### Requirement: Renditions are advertised as one master playlist

The streaming machine SHALL serve a master playlist per channel that advertises the three
renditions, each with its bandwidth, resolution and codecs, ordered from lowest bandwidth
to highest. The master playlist SHALL address each rendition relative to itself.

#### Scenario: Master playlist lists three renditions

- **WHEN** the master playlist for a channel is fetched
- **THEN** it advertises exactly three renditions with distinct bandwidths and
  resolutions, lowest bandwidth first

#### Scenario: A player resolves every advertised rendition

- **WHEN** a player loads the master playlist during a broadcast
- **THEN** each advertised rendition resolves to a playlist that serves segments

#### Scenario: Single-rendition address keeps working

- **WHEN** the channel's own playlist address is fetched directly, as recordings from
  before this change do
- **THEN** it serves the top rendition exactly as it did before

### Requirement: Rendition paths are publishable only from the streaming machine

The transcoded rendition paths SHALL accept a publish only from the streaming machine's
own loopback address, and SHALL reject a publish arriving from any other address. They
SHALL NOT be exempted from authentication.

#### Scenario: The transcoder publishes successfully

- **WHEN** the transcoder on the streaming machine publishes to a rendition path over
  loopback
- **THEN** the publish is authorised

#### Scenario: A remote publish to a rendition path is rejected

- **WHEN** a publish to a rendition path arrives from any address other than loopback,
  with or without a stream key
- **THEN** the publish is rejected

### Requirement: Rendition work follows the publish lifecycle

Transcoding SHALL start when an encoder connects to a channel and stop when it
disconnects, so that a machine with no broadcast on it performs no transcoding. Rendition
paths SHALL NOT record, and SHALL NOT trigger the broadcast lifecycle hooks.

#### Scenario: Idle machine does no transcoding

- **WHEN** no encoder is publishing
- **THEN** no transcoder process is running

#### Scenario: Transcoding stops when the encoder disconnects

- **WHEN** the encoder disconnects
- **THEN** the transcoder stops and the rendition paths stop serving

#### Scenario: Renditions do not start a second broadcast

- **WHEN** the transcoder publishes into a rendition path
- **THEN** no heartbeat is sent, no recording is written, and no broadcast row is created
  or modified for that path

#### Scenario: Recording captures the publisher's stream

- **WHEN** a broadcast is recorded for its VOD
- **THEN** the recording is taken from the publisher's own stream and carries no
  transcode loss
