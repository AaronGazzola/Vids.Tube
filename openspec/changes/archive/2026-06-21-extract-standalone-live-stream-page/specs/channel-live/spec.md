## MODIFIED Requirements

### Requirement: Channel page reflects live state

The system SHALL NOT render the live experience on the channel page
`/[channelSlug]`. Regardless of the channel's stream status, the channel page
SHALL show only its normal content (banner, avatar, channel identity, video
grid) and SHALL NOT render the live video player, the live broadcast's
title/description, a coming-soon countdown, or the live chat panel. The live and
scheduled/preview watch experience lives exclusively on the standalone
`/[channelSlug]/live` page (see the `live-stream-page` capability).

#### Scenario: Channel is live

- **WHEN** a viewer opens `/[channelSlug]` while the channel's stream `status`
  is `live` and an `hls_path` is present
- **THEN** the channel page renders only the channel banner, avatar, identity,
  and video grid, with no live player, title/description, countdown, or chat
  panel

#### Scenario: Channel is in preview only

- **WHEN** a viewer opens `/[channelSlug]` while the channel's most-recent stream
  is `preview` (the owner has not gone live yet)
- **THEN** the channel page renders only its normal content, with no live
  player, countdown, or chat panel

#### Scenario: Channel is not live

- **WHEN** a viewer opens `/[channelSlug]` while the channel has no `live`
  stream
- **THEN** the page renders the channel banner, avatar, and video grid with no
  live player

### Requirement: Standalone live page is superseded

The system SHALL continue to redirect the root `/live` path to the owner
channel's page rather than render a standalone always-on viewing surface there.
The root home `/` SHALL render the owner channel experience (channel banner,
avatar, identity, and video grid); because the live experience has moved to
`/[channelSlug]/live`, the root home SHALL NOT render a live player or chat
panel inline.

#### Scenario: Visiting the old live path

- **WHEN** a viewer navigates to `/live`
- **THEN** they are redirected to the owner channel's page rather than a
  standalone page with an always-present chat panel

#### Scenario: Root home shows the channel experience

- **WHEN** a viewer opens `/`
- **THEN** the owner channel experience is rendered (banner, avatar, identity,
  and video grid) with no live player or chat panel inline

## REMOVED Requirements

### Requirement: Offline placeholder replaces the player

**Reason**: The channel page no longer hosts a primary live area, so there is no
player for a placeholder to replace. The offline/coming-soon placeholder behavior
moves to the standalone `/[channelSlug]/live` page.
**Migration**: The coming-soon countdown and offline placeholder are now rendered
by the `live-stream-page` capability on `/[channelSlug]/live`; when no stream is
scheduled/preview/live, that page redirects to `/[channelSlug]` rather than
showing a placeholder.

### Requirement: Chat UI is gated to live

**Reason**: Chat is no longer rendered on the channel page at all, and the new
live page intentionally shows pre-stream chat in the scheduled/preview states
(YouTube-style), so a "gated to live" rule no longer applies.
**Migration**: Chat now renders on `/[channelSlug]/live` across the
scheduled/preview/live states per the `live-stream-page` capability.
