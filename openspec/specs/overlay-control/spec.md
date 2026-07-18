# overlay-control Specification

## Purpose
TBD - created by archiving change add-chat-overlay-scoring. Update Purpose after archive.
## Requirements
### Requirement: Studio overlay control

The system SHALL provide an owner-only studio page at `/studio/overlay` (guarded
like the rest of studio) that lets the channel owner manage chat featuring for
their live stream. The page SHALL:

- Show a toggle that enables/disables featuring by writing
  `chat_scoring_state.enabled` for the current live stream. The external scoring
  bot reads this flag to decide whether to feature messages; **this page does not
  itself run scoring** (no interval driver, no scoring route).
- Display the copyable OBS Browser Source URL for the overlay
  (`/overlay/<channelSlug>`).
- Show a live leaderboard of the stream's top viewers from `viewer_scores`
  (channel avatar + handle + ring/feature count), reusing the existing identity
  resolution.

#### Scenario: Owner enables featuring

- **WHEN** the channel owner toggles featuring on while their stream is live
- **THEN** `chat_scoring_state.enabled` is set true, so the external scoring bot
  (when running) begins featuring messages and the overlay starts animating

#### Scenario: Owner disables featuring

- **WHEN** the owner toggles featuring off
- **THEN** `chat_scoring_state.enabled` is set false, so the external bot stops
  producing new featured messages

#### Scenario: Owner copies the OBS URL

- **WHEN** the owner views `/studio/overlay`
- **THEN** the page shows the overlay Browser Source URL `/overlay/<channelSlug>`
  ready to copy into OBS

#### Scenario: Leaderboard reflects scoring

- **WHEN** viewers have been featured during the live stream
- **THEN** the studio leaderboard lists the top viewers by feature/score with their
  avatar, handle, and ring count

#### Scenario: Non-owner cannot access the control

- **WHEN** a non-owner visits `/studio/overlay`
- **THEN** they are redirected away by the studio owner guard and see no controls

### Requirement: Overlay control lives in the /live Settings tab

The system SHALL provide overlay control from the `/live` Settings tab rather than a
separate control route: the copyable OBS browser-source URLs (Highlights, Goal subs,
Goal likes, Goal viewers, Competition) with their dimensions, the competition opacity
control, the YouTube stream URL, the goals targets, and the mod bot / scoring
switches. The overlay URLs SHALL be copyable regardless of stream state; the overlay
**content** settings SHALL be stored on the single active stream.

#### Scenario: Copy overlay URLs without an active stream

- **WHEN** the owner opens the `/live` Settings tab with no active stream
- **THEN** all overlay URLs and dimensions are shown and copyable

#### Scenario: Overlay content is per-stream

- **WHEN** the owner sets the YouTube URL, goals, or scoring/highlighting switches
- **THEN** the values are stored on the active stream and consumed by the overlay
  renderers for that stream

