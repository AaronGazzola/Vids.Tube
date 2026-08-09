## ADDED Requirements

### Requirement: Playback over a fused set of spans

The shared player SHALL accept an ordered set of spans within its source and, when given
one, play only those spans in order, advancing past the stream time between them without
playing it. Its transport SHALL report position and duration in fused time, and seeking
through the transport SHALL land at the corresponding real position within the spans.
Given no span set, the player SHALL behave exactly as it does over a whole source.

#### Scenario: Playback advances past a gap

- **WHEN** playback reaches the end of one span and a later span follows
- **THEN** playback continues from the start of the next span

#### Scenario: Playback stops at the end of the last span

- **WHEN** playback reaches the end of the final span
- **THEN** playback stops rather than continuing into the rest of the source

#### Scenario: The transport measures the fused piece

- **WHEN** a span set covering 90 seconds in total is playing
- **THEN** the transport's duration is 90 seconds regardless of how far apart the spans
  are in the source

#### Scenario: Seeking within the fused piece

- **WHEN** the viewer seeks to a fused position that falls in the second span
- **THEN** the source seeks to the corresponding real position inside that span

#### Scenario: No span set

- **WHEN** the player is given no span set
- **THEN** its transport measures the whole source and no seam behaviour applies
