## ADDED Requirements

### Requirement: Bandwidth pressure lowers quality rather than stalling

The player SHALL move to a lower rendition and continue playing, rather than stalling,
when a live viewer's available bandwidth falls below what the current rendition needs.
The quality menu SHALL list every rendition the manifest advertises, so a viewer can also
choose one directly.

#### Scenario: Bandwidth falls below the top rendition

- **WHEN** a viewer is playing the top rendition and their available bandwidth drops
  below what it needs
- **THEN** the player moves to a lower rendition and playback continues

#### Scenario: Quality menu offers a real choice during a broadcast

- **WHEN** a viewer opens the quality menu during a live broadcast
- **THEN** three renditions are listed and choosing one pins playback to it

#### Scenario: Bandwidth recovers

- **WHEN** a viewer who dropped to a lower rendition regains bandwidth, without having
  pinned a rendition
- **THEN** the player returns to a higher rendition
