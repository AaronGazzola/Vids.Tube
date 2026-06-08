# channel-live Specification

## Purpose
TBD - created by archiving change fix-live-vod-experience. Update Purpose after archive.
## Requirements
### Requirement: Channel page reflects live state

The system SHALL render the live experience on the channel page
`/[channelSlug]`: when the channel's current stream is publicly `live`, the page
SHALL show the live video player, the live broadcast's title (and its description
when present), and the live chat panel in place of the page's primary content
area; when the channel is not publicly live, the page SHALL show its normal
content (banner, avatar, video grid). A stream in `preview` SHALL NOT be treated
as live for the channel page — viewers see the offline state until the owner goes
live.

#### Scenario: Channel is live

- **WHEN** a viewer opens `/[channelSlug]` while the channel's stream `status`
  is `live` and an `hls_path` is present
- **THEN** the page renders the live player, the broadcast's title (and
  description when present), and the live chat panel for that stream alongside the
  channel's identity (name, avatar)

#### Scenario: Channel is in preview only

- **WHEN** a viewer opens `/[channelSlug]` while the channel's most-recent stream
  is `preview` (the owner has not gone live yet)
- **THEN** the page renders the offline state with no live player and no chat

#### Scenario: Channel is not live

- **WHEN** a viewer opens `/[channelSlug]` while the channel has no `live`
  stream
- **THEN** the page renders the channel banner, avatar, and video grid with no
  live player

### Requirement: Offline placeholder replaces the player

The system SHALL render a static offline/scheduled placeholder component,
centered in the page's primary content area, whenever the channel is not live.
The placeholder SHALL NOT depend on any scheduling data and SHALL NOT display a
countdown or scheduled time.

#### Scenario: Offline placeholder shown

- **WHEN** a viewer opens `/[channelSlug]` and the channel is not live
- **THEN** a centered static placeholder is shown where the live player would
  otherwise be, indicating the channel is offline

#### Scenario: Placeholder carries no scheduling data

- **WHEN** the offline placeholder is shown
- **THEN** it displays static copy only, with no future date, countdown, or
  schedule controls

### Requirement: Chat UI is gated to live

The system SHALL render the chat UI on the channel page only while the channel
is live. When the channel is not live, no chat panel, no message list, and no
composer SHALL be rendered.

#### Scenario: No chat when offline

- **WHEN** a viewer opens `/[channelSlug]` and the channel is not live
- **THEN** no chat panel, message list, or composer is present in the DOM

#### Scenario: Chat appears when live

- **WHEN** the channel transitions to `live`
- **THEN** the chat panel appears and behaves per the live-chat capability
  (anonymous read, authenticated post)

### Requirement: Standalone live page is superseded

The system SHALL no longer expose a separate `/live` viewing destination as the
live home; the channel page is the canonical live location. Any remaining
`/live` entry point SHALL redirect to the channel page experience, and the root
home `/` SHALL render the owner channel experience, so that no duplicate,
always-on chat surface remains anywhere.

#### Scenario: Visiting the old live path

- **WHEN** a viewer navigates to `/live`
- **THEN** they are redirected to the owner channel's page rather than a
  standalone page with an always-present chat panel

#### Scenario: Root home shows the channel experience

- **WHEN** a viewer opens `/`
- **THEN** the owner channel experience is rendered (live player + chat when
  live, otherwise the offline placeholder with no chat) — not a separate
  always-on chat surface

