## MODIFIED Requirements

### Requirement: Channel home at root

The system SHALL render the owner's channel at `/`, showing the same experience
as `/[channelSlug]`: the channel header and video grid, with the live player and
live chat when the channel is live, or a static offline/scheduled placeholder and
no chat when it is not.

#### Scenario: Owner not streaming

- **WHEN** a visitor opens `/` and the channel is not live
- **THEN** the page shows the channel header, the video grid, and a centered
  static offline/scheduled placeholder, with no chat UI

#### Scenario: Owner streaming

- **WHEN** a visitor opens `/` and the channel is live
- **THEN** the page shows the live player and the live chat inline (not a banner
  linking elsewhere)

## REMOVED Requirements

### Requirement: Live watch page

**Reason**: The live experience is now hosted on the channel page (and the root
home), so a separate always-on live page with a persistent chat panel is no
longer part of the product.

**Migration**: `/live` redirects to the owner channel page. Live viewing and chat
happen on `/[channelSlug]` (and `/`) per the `channel-live` capability.
