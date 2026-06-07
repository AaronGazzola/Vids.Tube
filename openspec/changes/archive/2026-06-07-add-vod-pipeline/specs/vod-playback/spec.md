## ADDED Requirements

### Requirement: Public read of ready VODs only

The system SHALL expose only `ready` VODs through the public read path; rows in
`processing` or `failed` state SHALL NOT be readable by clients.

#### Scenario: Ready VOD is publicly readable

- **WHEN** anyone (anonymous or authenticated) queries `videos`
- **THEN** row-level security returns rows whose `status` is `ready` and withholds
  `processing`/`failed` rows

### Requirement: Free VOD playback

The system SHALL play a ready VOD from the configured CDN base URL without any
playback token, credit deduction, or viewer cap.

#### Scenario: Anonymous viewer watches a VOD

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD
- **THEN** the page plays the MP4 from
  `${NEXT_PUBLIC_VOD_BASE_URL}/<mp4_path>` in a seekable native video player, with
  no sign-in wall and no credit cost

#### Scenario: Seeking within a VOD

- **WHEN** a viewer seeks to a later position in the VOD
- **THEN** playback resumes from that position via HTTP range requests served by
  the CDN

#### Scenario: Non-ready or missing VOD

- **WHEN** a viewer opens `/watch/<videoId>` for an id that is not a `ready` VOD
- **THEN** the page shows a "video not available" state rather than a broken
  player

### Requirement: Channel VOD listing

The channel page SHALL list the channel's `ready` VODs, newest first, each
showing its thumbnail and title and linking to its watch page.

#### Scenario: Channel with published VODs

- **WHEN** a visitor opens a channel page that has `ready` VODs
- **THEN** the page lists those VODs newest-first with thumbnails, replacing the
  empty-state placeholder

#### Scenario: Channel with no VODs

- **WHEN** a visitor opens a channel page that has no `ready` VODs
- **THEN** the page shows the empty "no videos yet" state
