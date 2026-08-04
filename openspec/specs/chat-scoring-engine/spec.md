# chat-scoring-engine Specification

## Purpose
TBD - created by archiving change add-chat-scoring. Update Purpose after archive.
## Requirements
### Requirement: Cross-origin participant identity

The scoring tables SHALL represent both Vids.Tube users (who have an `auth.users`
row) and account-less YouTube chatters. `featured_messages`, `viewer_scores`, and
`score_events` SHALL make `user_id` nullable and carry `origin` (`'vidstube'` or
`'youtube'`), `external_author_id`, `author_name`, and `author_avatar_url`.
`featured_messages.chat_message_id` SHALL be nullable (a YouTube feature references no
`chat_messages` row), while remaining unique so a Vids.Tube message is featured at
most once. `viewer_scores` SHALL be keyed by `(stream_id, participant_key)` where
`participant_key` is generated as `coalesce(user_id::text, origin || ':' ||
external_author_id)`. RLS SHALL remain public-read / service-write.

#### Scenario: A YouTube chatter is featured without an account

- **WHEN** the engine features a YouTube message
- **THEN** a `featured_messages` row is written with `origin = 'youtube'`, a null
  `user_id`/`chat_message_id`, and `external_author_id`/`author_name`/`author_avatar_url`
  populated

#### Scenario: Scores key off participant, not user_id

- **WHEN** the same YouTube chatter is scored twice in a stream
- **THEN** both updates land on one `viewer_scores` row keyed by `(stream_id,
  participant_key)`, not two

#### Scenario: A Vids.Tube message is still featured at most once

- **WHEN** the engine tries to feature a Vids.Tube `chat_message_id` already featured
- **THEN** the unique constraint rejects the duplicate

### Requirement: Scoring job over transcript and both chats

The worker SHALL run a scoring job (a sibling of the transcription job under the same
dispatcher) for the eligible live stream while `chat_scoring_state.enabled` is true,
holding the `chat_scoring_state.locked_until` lock. It SHALL read Vids.Tube chat
(`chat_messages` realtime, `origin = 'vidstube'`) and, when the stream has a
`youtube_video_id`, YouTube chat (the AZ-125 poller, `origin = 'youtube'`), merging
both into one origin-tagged buffer of messages newer than the
`chat_scoring_state.last_scored_at` cursor.

#### Scenario: Scoring runs only when enabled

- **WHEN** `chat_scoring_state.enabled` is false for the live stream
- **THEN** the scoring job does not score or write

#### Scenario: Both chats feed the buffer

- **WHEN** the live stream has a `youtube_video_id` and messages arrive on both
  Vids.Tube and YouTube chat
- **THEN** the buffer contains both, each tagged with its `origin` and author identity

#### Scenario: The cursor prevents re-scoring

- **WHEN** the job restarts mid-stream
- **THEN** it scores only messages newer than `last_scored_at` and does not re-score
  earlier ones

### Requirement: Model-driven featuring and scoring with Vids.Tube weighting

On an interval, the engine SHALL call `claude -p` with the rolling transcript window,
the new message batch, and a rubric, and SHALL parse a strict JSON result naming
which messages to feature (with score, categories, reason) and per-author score
deltas across engagement / humour / contribution. Vids.Tube messages SHALL be weighted
higher than YouTube messages. Prompt-building and response-parsing SHALL be pure,
exported, unit-testable functions, and a malformed or unmappable result SHALL be
skipped without corrupting state.

#### Scenario: A featured message is written from the model result

- **WHEN** the model marks a buffered message to feature
- **THEN** the engine writes a `featured_messages` row (origin + identity, `ring_level`
  = the author's current `features_count`), upserts `viewer_scores` on
  `participant_key`, inserts a `score_events` row with the reason in `metadata`, and
  advances `last_scored_at`

#### Scenario: Vids.Tube outscores YouTube for equivalent messages

- **WHEN** equivalent messages arrive from a Vids.Tube user and a YouTube chatter
- **THEN** the Vids.Tube message receives more points (rubric + multiplier)

#### Scenario: A bad model cycle is skipped

- **WHEN** `claude -p` returns malformed JSON or refs that don't map to buffered
  messages
- **THEN** the engine skips that cycle and writes nothing for it, leaving prior state
  intact

### Requirement: Overlay and leaderboard render both author origins

The featured-message overlay and the studio `viewer_scores` leaderboard SHALL render a
Vids.Tube author via `channelAssetUrl` (a storage path) and a YouTube author via the
stored `author_name` + `author_avatar_url` (a full URL), so YouTube highlights and
scores display.

#### Scenario: A YouTube highlight shows its avatar and name

- **WHEN** a `featured_messages` row with `origin = 'youtube'` reaches the overlay
- **THEN** the overlay animates the avatar from `author_avatar_url` with the stored
  `author_name`, not a Vids.Tube channel lookup

#### Scenario: The leaderboard mixes origins

- **WHEN** both Vids.Tube and YouTube viewers have scores
- **THEN** the studio leaderboard lists both, each with the correct avatar source for
  its origin

### Requirement: The scoring rubric is a versioned configuration

The rubric that tells the model what to reward SHALL live in one shared configuration carrying the criteria, the site-message multiplier, the rubric text, and a version string. The live scorer and the history backfill SHALL both read that configuration, so neither can drift from the other. The version SHALL be a deliberately chosen string, changed when the wording changes, rather than derived from the text.

#### Scenario: Both paths use the same rubric

- **WHEN** the rubric text is changed in the configuration
- **THEN** the live scorer and the backfill both use the changed wording, with no second copy to update

#### Scenario: The version marks a decision, not an edit

- **WHEN** the rubric text is reformatted without changing what it asks for
- **THEN** the version is unchanged unless it is deliberately bumped

### Requirement: Every rating records the configuration that produced it

Each `score_events` row SHALL carry the version of the scoring configuration that produced it. This SHALL make it possible to attribute a chatter's standing to a rubric, to clear exactly one version's ratings before a re-run, and to compare two configurations on the same broadcast without one destroying the other's evidence.

#### Scenario: A rating is attributable

- **WHEN** a rating is written by either the live scorer or the backfill
- **THEN** it carries the version of the configuration in force at the time

#### Scenario: One version can be cleared without touching another

- **WHEN** ratings from two configuration versions exist for a broadcast and one version is cleared
- **THEN** only that version's ratings are removed

### Requirement: Points reward quality rather than volume

A message's quality SHALL be the highest of its criteria rather than their sum, so a message that excels at one thing is not marked down for the others. Points SHALL be zero below a configured quality threshold and SHALL rise on a curve above it, so a chatter sending many unremarkable messages earns nothing while a chatter sending a few good ones earns. The threshold, the curve and the ceiling SHALL live in the shared configuration.

#### Scenario: Ordinary chat earns nothing

- **WHEN** a message is rated at or below the threshold on every criterion
- **THEN** it earns zero points

#### Scenario: Excelling at one thing is enough

- **WHEN** a message is rated highly for humour and at zero for the other criteria
- **THEN** it earns more than a message rated moderately on all three

#### Scenario: Volume loses to quality

- **WHEN** one chatter sends a hundred messages rated below the threshold and another sends five rated well above it
- **THEN** the second chatter earns more

### Requirement: Points can be re-derived without re-scoring

Each rating SHALL store the per-message criteria and text that produced it, so a changed threshold, curve or ceiling can be applied by recomputing from stored ratings, with no further model calls. Only a change to the rubric itself SHALL require re-scoring.

#### Scenario: A calibration change costs no model calls

- **WHEN** the point ceiling is changed and the re-derive pass is run
- **THEN** every affected rating, per-broadcast score and membership is updated from the stored criteria, and the model is not called

#### Scenario: A rating without a breakdown is reported, not guessed

- **WHEN** the re-derive pass meets a rating that carries no per-message breakdown
- **THEN** it reports how many such ratings exist and leaves them unchanged

