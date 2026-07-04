# featured-overlay Specification

## Purpose
TBD - created by archiving change add-chat-overlay-scoring. Update Purpose after archive.
## Requirements
### Requirement: Transparent OBS overlay route

The system SHALL serve a display-only overlay at `/overlay/[channelSlug]` rendered
in a dedicated `(overlay)` route group whose layout does NOT include the site
navigation, footer, or toaster, and whose background is transparent so it can be
used directly as an OBS Browser Source over video. The overlay SHALL resolve the
channel by slug and its current live stream using the existing channel/live-stream
data paths, and SHALL show nothing (a transparent empty page) when the channel is
not live.

#### Scenario: Overlay renders transparent with no site chrome

- **WHEN** an OBS Browser Source loads `/overlay/[channelSlug]`
- **THEN** the page renders with a transparent background and without the site
  navigation, footer, or toaster

#### Scenario: Overlay is idle when not live

- **WHEN** `/overlay/[channelSlug]` loads while the channel has no live stream
- **THEN** the overlay renders nothing visible and shows no featured avatars

### Requirement: Featured avatar animates across screen with progress rings

When a message is featured for the live stream, the overlay SHALL animate that
message's author avatar traveling across the screen, and SHALL draw a number of
concentric rings around the avatar equal to the featured row's `ring_level` (one
ring per prior-plus-current feature, with a visible gap between rings — the
"planet rings" progress motif). The avatar SHALL be the author's channel avatar
(via `channelAssetUrl`) with an initials fallback. The overlay SHALL receive
featured rows in realtime via the `featured_messages` subscription, and SHALL play
multiple features in sequence so animations do not overlap.

#### Scenario: A new feature animates the author avatar

- **WHEN** a new `featured_messages` row is inserted for the live stream
- **THEN** the overlay animates that author's avatar across the screen with
  `ring_level` concentric rings drawn around it

#### Scenario: Repeat features show more rings

- **WHEN** the same viewer is featured again with a higher `ring_level`
- **THEN** their next animation draws that many concentric rings, one more than before

#### Scenario: Concurrent features play in sequence

- **WHEN** multiple `featured_messages` rows arrive close together
- **THEN** the overlay plays their animations one after another rather than
  overlapping them on screen

