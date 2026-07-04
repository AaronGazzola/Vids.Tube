# avatar-competition Specification

## Purpose
TBD - created by archiving change add-avatar-competition. Update Purpose after archive.
## Requirements
### Requirement: Score-driven plant growth mapping

The system SHALL provide a pure function `plantShape(score, topScore)` that maps a
viewer's score to a plant size relative to the current leader: `growth = topScore > 0 ?
clamp(score / topScore, 0, 1) : 0`, a stem height interpolated from a minimum to a
maximum by `growth`, and leaf/flower counts that increase in steps as the score rises.
The mapping SHALL be monotonic (a higher score never yields a smaller plant) and
SHALL render no UI itself.

#### Scenario: The leader is the tallest plant

- **WHEN** a viewer's `score` equals `topScore`
- **THEN** `growth` is 1 and the stem is at its maximum height

#### Scenario: Growth is monotonic and relative

- **WHEN** viewer A's score is higher than viewer B's (same `topScore`)
- **THEN** A's stem height is greater than or equal to B's

#### Scenario: No participants yet

- **WHEN** `topScore` is 0
- **THEN** `growth` is 0 and the plant is at its minimum

### Requirement: Competition overlay reads viewer_scores (no schema change)

The system SHALL serve a competition overlay at `/overlay/[channelSlug]/competition`
in the existing transparent `(overlay)` group that reads the top viewers from the
existing `viewer_scores` for the channel's live stream — no new table and no
migration. Each viewer SHALL be resolved to an author/avatar by origin (Vids.Tube via
`channelAssetUrl`, YouTube via the stored `author_avatar_url`), reusing the existing
resolver. The overlay SHALL render nothing visible when the channel is not live or has
no scores.

#### Scenario: Top viewers render as a garden

- **WHEN** the channel is live and `viewer_scores` has rows
- **THEN** the overlay renders one plant per top viewer (capped by `?max=`, default 24),
  each sized relative to the leader, ordered by score

#### Scenario: Both origins render with the right avatar

- **WHEN** the top viewers include both a Vids.Tube user and a YouTube chatter
- **THEN** the Vids.Tube plant shows the channel avatar and the YouTube plant shows the
  stored `author_avatar_url`, each with the viewer's name

#### Scenario: Idle when not live or unscored

- **WHEN** the channel is not live, or `viewer_scores` is empty for the stream
- **THEN** the overlay renders nothing visible

### Requirement: Polled progress and studio URL

The system SHALL poll the competition data on a short interval (default ~5s) via
`getCompetitionAction(channelSlug)` + a `useCompetition` hook so plants grow as scores
update, without subscribing `viewer_scores` to realtime. The studio overlay page SHALL
display the copyable competition OBS URL `/overlay/<channelSlug>/competition`.

#### Scenario: Plants grow as scores update

- **WHEN** the scoring engine raises a viewer's `total_score`
- **THEN** within one poll interval the overlay re-renders that viewer's plant larger

#### Scenario: Owner can copy the competition URL

- **WHEN** the owner views `/studio/overlay`
- **THEN** the competition OBS URL is shown ready to copy into OBS

