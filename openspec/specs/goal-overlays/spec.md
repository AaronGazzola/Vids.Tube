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

### Requirement: A goal overlay marks a rise in its metric

A goal overlay SHALL play an animation when the value it shows rises above the value it was last showing.

The animation SHALL be driven by the value changing, not by a refresh completing. A refresh reporting an
unchanged value SHALL animate nothing, and a value that falls SHALL animate nothing.

The animation SHALL play once per rise, however large the rise, and SHALL NOT queue or repeat.

#### Scenario: A subscriber arrives

- **GIVEN** a subscriber goal overlay showing a number
- **WHEN** the polled value comes back one higher
- **THEN** the overlay plays its animation once

#### Scenario: A poll that changes nothing

- **GIVEN** a goal overlay showing a number
- **WHEN** the polled value comes back the same
- **THEN** nothing animates

#### Scenario: A value that falls

- **GIVEN** a viewer goal overlay showing a number
- **WHEN** the polled value comes back lower, as viewers leave
- **THEN** nothing animates

#### Scenario: A jump of several

- **WHEN** the value rises by more than one between polls
- **THEN** the animation plays exactly once, not once per unit

### Requirement: The first value shown is not a rise

A goal overlay SHALL NOT animate the first value it shows. Arriving at a number from nothing is not a
rise, and animating it would make every page load, every OBS source refresh and every reconnect look like
a celebration.

#### Scenario: The overlay loads

- **WHEN** a goal overlay renders its first value
- **THEN** nothing animates

#### Scenario: The browser source is refreshed mid-broadcast

- **GIVEN** a broadcast with a subscriber count well above zero
- **WHEN** the OBS browser source is refreshed
- **THEN** the overlay shows the current number without animating it

### Requirement: Arranging a layout does not animate

A goal overlay SHALL NOT animate while the Overlays tab is in its resize-and-reposition mode, so that
moving and scaling boxes stays legible.

Outside that mode the Overlays tab SHALL animate exactly as the broadcast does, so the streamer can see
what the audience will see.

#### Scenario: Dragging a box

- **GIVEN** the Overlays tab is in resize-and-reposition mode
- **WHEN** a goal metric rises
- **THEN** nothing animates

#### Scenario: Watching the composer normally

- **GIVEN** the Overlays tab is not in resize-and-reposition mode
- **WHEN** a goal metric rises
- **THEN** the overlay animates as it does on the broadcast

### Requirement: The animation reads at broadcast scale

The animation SHALL be sized relative to the goal overlay's own drawn size, so that it reads on a
1080x1920 canvas at the scale the streamer set rather than only in a desktop-sized preview.

The animation SHALL be composited transform and opacity only, so that OBS captures a moved layer rather
than a relayout at the broadcast frame rate.

The animation SHALL NOT change the space the overlay occupies, so a box positioned against a live picture
does not shift while it plays.

#### Scenario: A scaled-up goal

- **GIVEN** a goal overlay whose box is scaled to twice its base size
- **WHEN** its metric rises
- **THEN** the animation is drawn proportionally to the overlay at that size

#### Scenario: Neighbouring boxes hold still

- **WHEN** a goal overlay animates
- **THEN** no other overlay moves, and the animating overlay occupies the same space throughout

