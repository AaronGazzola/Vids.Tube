# chat-scoring Specification

## Purpose
TBD - created by archiving change add-chat-overlay-scoring. Update Purpose after archive.
## Requirements
### Requirement: Featured-message and per-viewer scoring data model

The system SHALL persist a scoring data model that an external scoring engine
populates and the overlay reads. It SHALL define four tables, all publicly
readable and writable only by the secret-key service client (no public
insert/update RLS policies):

- `featured_messages` — one row per featured chat message, unique on
  `chat_message_id` (a message SHALL be featurable at most once), carrying `score`
  (0–100), `categories` (text array), `reason`, and `ring_level` (the author's
  `features_count` at the moment of featuring). It SHALL be added to the
  `supabase_realtime` publication.
- `viewer_scores` — keyed by `(stream_id, user_id)`, with `total_score`,
  `features_count`, and `last_featured_at`. `features_count` SHALL equal the number
  of times that viewer has been featured in that stream (the overlay's ring count).
- `score_events` — an append-only log with `type`, `points`, and a `metadata`
  JSON column. It SHALL be the record of why scores change and the extension point
  for future game events, and SHALL NOT be mutated after insert.
- `chat_scoring_state` — keyed by `stream_id`, with an `enabled` flag (read by the
  external scoring engine to decide whether to feature messages), a `last_scored_at`
  cursor, and a `locked_until` mutex.

The scoring engine that populates these tables (reading chat + the stream
transcript and calling the model) is **out of scope** of this change; it is an
external local bot tracked separately.

#### Scenario: A message can be featured at most once

- **WHEN** a writer inserts a `featured_messages` row for a `chat_message_id` that
  is already featured
- **THEN** the unique constraint rejects the duplicate, so the message is featured
  at most once

#### Scenario: ring_level reflects the viewer's feature count

- **WHEN** a viewer's `features_count` is N at the time one of their messages is featured
- **THEN** that `featured_messages` row's `ring_level` is N, so the overlay can draw
  the ring count from the row alone without an extra query

#### Scenario: Tables are publicly readable but not publicly writable

- **WHEN** an anonymous client reads `featured_messages`, `viewer_scores`,
  `score_events`, or `chat_scoring_state`
- **THEN** the rows are returned; AND any attempt to insert or update them without
  the secret-key service client is denied by RLS

#### Scenario: Score history is append-only

- **WHEN** a viewer's score changes
- **THEN** the change is recorded as a new `score_events` row (with `points` and the
  reason in `metadata`) and existing `score_events` rows are not mutated

