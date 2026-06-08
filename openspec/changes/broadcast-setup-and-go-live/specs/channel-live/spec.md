## MODIFIED Requirements

### Requirement: Channel page reflects live state

The system SHALL render the live experience on the channel page
`/[channelSlug]`: when the channel's current stream is publicly `live`, the page
SHALL show the live video player, the live broadcast's title, and the live chat
panel in place of the page's primary content area; when the channel is not
publicly live, the page SHALL show its normal content (banner, avatar, video
grid). A stream in `preview` SHALL NOT be treated as live for the channel page —
viewers see the offline state until the owner goes live.

#### Scenario: Channel is live

- **WHEN** a viewer opens `/[channelSlug]` while the channel's stream `status`
  is `live` and an `hls_path` is present
- **THEN** the page renders the live player, the broadcast's title, and the live
  chat panel for that stream alongside the channel's identity (name, avatar)

#### Scenario: Channel is in preview only

- **WHEN** a viewer opens `/[channelSlug]` while the channel's most-recent stream
  is `preview` (the owner has not gone live yet)
- **THEN** the page renders the offline state with no live player and no chat

#### Scenario: Channel is not live

- **WHEN** a viewer opens `/[channelSlug]` while the channel has no `live`
  stream
- **THEN** the page renders the channel banner, avatar, and video grid with no
  live player
