# goal-overlays Specification

## Purpose
TBD - created by archiving change add-goal-overlays. Update Purpose after archive.
## Requirements
### Requirement: Per-stream goal state

The system SHALL store goal state per stream in a `stream_goals` table keyed by
`stream_id` (FK `streams`, on delete cascade): the targets `subs_goal`/`likes_goal`/
`viewers_goal`, the nullable start baseline `baseline_subs`/`baseline_likes`/
`baseline_viewers`, and `started_at`. It SHALL be publicly readable
(`select using (true)`) and writable only by the owner/secret-key client (no public
insert/update policies). The YouTube video mapping SHALL be reused from
`streams.youtube_video_id`/`youtube_channel_id`, not duplicated here.

#### Scenario: Goals are publicly readable but not publicly writable

- **WHEN** an anonymous client reads `stream_goals`
- **THEN** the row is returned; AND any insert or update without the owner/secret-key
  client is denied by RLS

#### Scenario: Goals reuse the stream's YouTube mapping

- **WHEN** the goals path needs the YouTube video for a stream
- **THEN** it reads `streams.youtube_video_id`/`youtube_channel_id` rather than a
  copy on `stream_goals`

### Requirement: Pure goal-progress computation

The system SHALL compute per-metric progress with a pure function
`computeGoalProgress(counts, baseline, goals)` returning, for each of subs/likes/
viewers, `{ current, target, total, goal, pct, reached }`. Subs and likes SHALL be
measured as gain from the start baseline (`current = now - baseline`,
`target = goal - baseline`); viewers SHALL be the absolute live count
(`current = now`, `target = goal`). `pct` SHALL be clamped to 0–100 and `reached`
SHALL be `pct >= 100`. A null baseline SHALL be treated as 0.

#### Scenario: Subs/likes measure gain from baseline

- **WHEN** the subs goal is 1000, the baseline was 950, and the live count is 980
- **THEN** subs progress is `current = 30`, `target = 50`, `pct = 60`, `reached = false`

#### Scenario: Viewers measure the absolute live count

- **WHEN** the viewers goal is 100 and the live count is 78
- **THEN** viewers progress is `current = 78`, `target = 100`, `pct = 78`

#### Scenario: Progress is clamped and reached flips at 100%

- **WHEN** the live count meets or exceeds the target
- **THEN** `pct` is clamped to 100 and `reached` is true

### Requirement: Transparent goals overlay route with demo mode

The system SHALL serve a goals overlay at `/overlay/[channelSlug]/goals` in the
existing transparent `(overlay)` group (no site chrome). It SHALL honor `?bars=` (any
ordered subset of `subs,likes,viewers`, default all), `?interval=` (seconds, min 3,
default 10), `?height=` (default 320), and `?demo=1`. It SHALL render a bar/ring per
selected metric with the "goal reached" rainbow animation + glow, and SHALL render
nothing visible when the channel is not live or has no YouTube video / goals. In demo
mode it SHALL render a draggable/resizable layout-preview stage instead of polling.

#### Scenario: Overlay renders the selected metrics over transparent background

- **WHEN** OBS loads `/overlay/[channelSlug]/goals?bars=subs,likes`
- **THEN** the subs and likes bars render on a transparent background with no nav/footer

#### Scenario: Goal reached shows the rainbow state

- **WHEN** a metric's `reached` becomes true
- **THEN** that bar/ring switches to the rainbow animation with the glow

#### Scenario: Demo mode previews layout without a live stream

- **WHEN** `/overlay/[channelSlug]/goals?demo=1` loads
- **THEN** a draggable/resizable stage with sample metrics renders and no YouTube polling
  occurs

#### Scenario: Idle when not live or unconfigured

- **WHEN** the channel is not live, or has no `youtube_video_id` or goals
- **THEN** the overlay renders nothing visible

### Requirement: YouTube-backed read path

The system SHALL expose `getGoalProgressAction(channelSlug)` that resolves the
channel's live stream, reads `streams.youtube_video_id`/`youtube_channel_id` and
`stream_goals`, fetches metrics via the shared YouTube client (`fetchVideoData` +
`fetchSubs`), runs `computeGoalProgress`, and returns `{ active, isLive, metrics }`.
The overlay SHALL poll it on the configured interval. The YouTube API key SHALL stay
server-side; the overlay client SHALL NOT call YouTube directly.

#### Scenario: Progress is computed server-side from live metrics

- **WHEN** the overlay polls a live, configured channel
- **THEN** the action returns the per-metric progress computed from current YouTube
  metrics, without exposing the API key to the client

#### Scenario: Inactive response when unconfigured

- **WHEN** the channel is not live or has no YouTube video / goals
- **THEN** the action returns `active: false` and the overlay shows nothing

### Requirement: Studio goal controls

The system SHALL let the owner manage goals from `/studio/overlay`: set the three
targets (`setGoalsAction`) and start tracking (`startGoalsAction`), where starting
snapshots the current YouTube counts as the baseline and sets `started_at`. The page
SHALL show the copyable goals OBS URL `/overlay/<channelSlug>/goals`.

#### Scenario: Owner sets targets

- **WHEN** the owner saves subs/likes/viewers targets
- **THEN** they are written to `stream_goals` for the live stream

#### Scenario: Start snapshots the baseline

- **WHEN** the owner clicks Start
- **THEN** the current YouTube subscriber/like/viewer counts are stored as the baseline
  with `started_at`, so subs/likes progress measures from that moment

#### Scenario: Non-owner cannot manage goals

- **WHEN** a non-owner attempts to set or start goals
- **THEN** the action is rejected by the owner guard and no rows change

