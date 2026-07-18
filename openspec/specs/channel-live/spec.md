# channel-live Specification

## Purpose
TBD - created by archiving change fix-live-vod-experience. Update Purpose after archive.
## Requirements
### Requirement: Channel page reflects live state

The system SHALL NOT embed the live video player on the channel page
`/[channelSlug]`; the live/scheduled/preview watch experience lives exclusively
on the standalone `/[channelSlug]/live` page. The channel page SHALL render its
normal content (banner, avatar, channel identity, video grid) and, in addition,
SHALL surface entry points to the live page based on the channel's stream state:

- When the channel's stream is `live` (status `live` with an `hls_path`) OR has a
  `scheduled`/`preview` stream (via `getUpcomingScheduledBroadcastAction`), the
  page SHALL render a featured card above the video grid that links to
  `/[channelSlug]/live`. The card SHALL show a red **LIVE** badge when live, and a
  **Scheduled**/**Upcoming** badge with the broadcast's date/time when
  scheduled/preview. `live` SHALL take precedence over scheduled/preview.
- When the channel is `live`, the channel avatar SHALL display a red ring and SHALL
  link to `/[channelSlug]/live`. When the channel is not live, the avatar SHALL
  have no ring and SHALL NOT link to the live page.

#### Scenario: Channel is live

- **WHEN** a viewer opens `/[channelSlug]` while the channel's stream `status`
  is `live` and an `hls_path` is present
- **THEN** the page renders the banner, avatar, identity, and video grid with no
  embedded live player, a featured card with a red **LIVE** badge linking to
  `/[channelSlug]/live`, and a red ring around the avatar that links to
  `/[channelSlug]/live`

#### Scenario: Channel is scheduled or in preview

- **WHEN** a viewer opens `/[channelSlug]` while the channel is not live but has a
  `scheduled` or connected `preview` stream
- **THEN** the page renders a featured card with a **Scheduled**/**Upcoming** badge
  and the broadcast's date/time linking to `/[channelSlug]/live`, with no embedded
  player and no avatar ring

#### Scenario: Channel is not live

- **WHEN** a viewer opens `/[channelSlug]` while the channel has no `live`,
  `preview`, or upcoming `scheduled` stream
- **THEN** the page renders the banner, avatar, and video grid with no featured
  card, no avatar ring, and no live player

### Requirement: Standalone live page is superseded

The system SHALL continue to redirect the root `/live` path to the owner
channel's page `/[ownerSlug]`. The root home `/` SHALL redirect to the owner
channel's live page `/[ownerSlug]/live` when (and only when) the owner channel's
stream is `live` (status `live` with an `hls_path`); otherwise `/` SHALL render
the owner channel page (which itself surfaces the live-page entry points per the
"Channel page reflects live state" requirement). The redirect SHALL NOT fire
while the stream state is still loading.

#### Scenario: Visiting the old live path

- **WHEN** a viewer navigates to `/live`
- **THEN** they are redirected to the owner channel's page `/[ownerSlug]`

#### Scenario: Home redirects to the live page when live

- **WHEN** a viewer opens `/` while the owner channel's stream is `live` with an
  `hls_path` present
- **THEN** they are redirected to `/[ownerSlug]/live`

#### Scenario: Home shows the channel page when not live

- **WHEN** a viewer opens `/` while the owner channel is scheduled/preview or has
  no stream
- **THEN** the owner channel page is rendered (banner, avatar, identity, video
  grid, and any featured live/upcoming card) with no redirect

#### Scenario: Home does not redirect before stream state resolves

- **WHEN** a viewer opens `/` and the owner channel or its stream state is still
  loading
- **THEN** a loading skeleton is shown and no redirect occurs until the state has
  settled

### Requirement: Scheduled waiting room on the public surface

The system SHALL render a waiting room on the public live surface for a dated pre-live
broadcast (a `scheduled` broadcast, or its `preview` while the audience still waits):
a countdown to `scheduled_start_at`, a waiting count of present viewers, and — when
`waiting_room_chat` is on — the live chat. At go-live the same surface SHALL replace
the countdown with the live player without navigating away, preserving the chat. A
private `draft` or ad-hoc `preview` SHALL render nothing public.

#### Scenario: Audience waits and chats before go-live

- **WHEN** a viewer opens the public surface for a dated `scheduled` broadcast with
  `waiting_room_chat` on
- **THEN** they see a countdown, a waiting count, and the chat they can read (and post
  to when signed in)

#### Scenario: Countdown becomes the live player at go-live

- **WHEN** the owner goes live from that broadcast
- **THEN** the same surface swaps the countdown for the live player, and the chat
  continues uninterrupted

#### Scenario: Private broadcast is not shown

- **WHEN** the active stream is a `draft` or an ad-hoc `preview`
- **THEN** the public surface shows no waiting room and no countdown for it

