## MODIFIED Requirements

### Requirement: Free VOD playback

The system SHALL play a ready VOD from the configured CDN base URL in a custom
video player without any playback token, credit deduction, or viewer cap, and
SHALL show the VOD's title and (when present) its inherited description below the
player.

#### Scenario: Anonymous viewer watches a VOD

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD
- **THEN** the page plays the MP4 from
  `${NEXT_PUBLIC_VOD_BASE_URL}/<mp4_path>` in the custom seekable player, with
  no sign-in wall and no credit cost, and shows the VOD's title

#### Scenario: VOD with a description

- **WHEN** a viewer opens `/watch/<videoId>` for a `ready` VOD that has a
  `description`
- **THEN** the page shows that description below the title

#### Scenario: Seeking within a VOD

- **WHEN** a viewer seeks to a later position in the VOD
- **THEN** playback resumes from that position via HTTP range requests served
  by the CDN

#### Scenario: Non-ready or missing VOD

- **WHEN** a viewer opens `/watch/<videoId>` for an id that is not a `ready`
  VOD
- **THEN** the page shows a "video not available" state rather than a broken
  player
