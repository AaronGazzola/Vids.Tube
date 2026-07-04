# live-stream-page Specification

## Purpose
TBD - created by archiving change extract-standalone-live-stream-page. Update Purpose after archive.
## Requirements
### Requirement: Standalone live-stream page

The system SHALL serve a standalone live-stream page at `/[channelSlug]/live`
that owns the watch experience for that channel's current or next stream. The
page SHALL resolve the channel by slug and select its render state from the
channel's stream data: `live` when the channel's stream `status` is `live` with
an `hls_path` present; otherwise `scheduled`/`preview` when the channel has an
upcoming scheduled broadcast or a connected preview (the
`getUpcomingScheduledBroadcastAction` / `useUpcomingScheduled` data path);
otherwise no stream.

#### Scenario: Live state renders the player and chat

- **WHEN** a viewer opens `/[channelSlug]/live` while the channel's stream
  `status` is `live` and an `hls_path` is present
- **THEN** the page renders the `LiveStage` live player, the broadcast's title
  (and its description when present), and the `LiveChat` panel bound to that
  live stream

#### Scenario: Scheduled state renders the countdown and pre-stream chat

- **WHEN** a viewer opens `/[channelSlug]/live` while the channel is not live but
  has an upcoming `scheduled` broadcast
- **THEN** the page renders the coming-soon countdown card (thumbnail, title, and
  countdown to `scheduled_start_at`) alongside the `LiveChat` panel

#### Scenario: Preview state reuses the countdown and pre-stream chat

- **WHEN** a viewer opens `/[channelSlug]/live` while the channel's stream is in
  `preview` (connected but not yet live)
- **THEN** the page renders the same coming-soon countdown card and the
  `LiveChat` panel, with no separate preview-player rendering

### Requirement: Pre-stream chat is not gated to live

The system SHALL render the live chat panel on `/[channelSlug]/live` in the
scheduled and preview states as well as the live state, allowing viewers to post
before the stream starts (YouTube-style pre-stream chat). Posting SHALL require
authentication and SHALL persist to the scheduled/preview/live stream row; no
stream-status gate SHALL block posting in the scheduled or preview state.

#### Scenario: Authenticated viewer posts before the stream is live

- **WHEN** an authenticated viewer submits a chat message on `/[channelSlug]/live`
  while the stream is in the scheduled or preview state
- **THEN** the message is persisted against that stream row and appears in the
  chat panel in real time

#### Scenario: Anonymous viewer sees the sign-in prompt before the stream is live

- **WHEN** an anonymous viewer views `/[channelSlug]/live` in the scheduled or
  preview state
- **THEN** the chat panel renders with the message list visible and a sign-in
  prompt in place of the composer

### Requirement: No-stream redirect

The system SHALL redirect `/[channelSlug]/live` to the channel page
`/[channelSlug]` when the channel has no `live`, `preview`, or upcoming
`scheduled` stream, so the live page never presents an empty watch surface.

#### Scenario: No active or upcoming stream

- **WHEN** a viewer opens `/[channelSlug]/live` and the channel has no live,
  preview, or upcoming scheduled stream
- **THEN** the viewer is redirected to `/[channelSlug]`

#### Scenario: Unknown channel slug

- **WHEN** a viewer opens `/[channelSlug]/live` for a slug with no matching
  channel
- **THEN** the viewer is redirected to `/[channelSlug]` (which renders its own
  not-found state)

