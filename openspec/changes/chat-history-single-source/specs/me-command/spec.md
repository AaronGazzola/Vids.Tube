# me-command Specification (delta)

## MODIFIED Requirements

### Requirement: Live-accruing stats

The system SHALL derive `!me` stats from `chat_messages` alone, with no
archive watermark and no pre-aggregated total added to a raw count. Message
totals SHALL be the count of `chat_messages` rows matching the identity by
`user_id` or by `origin` `youtube` with the identity's `external_author_id`;
streams attended SHALL be the distinct `stream_id` values across those rows; and
first-seen SHALL be the earliest `created_at` among them. Stats SHALL stay
current from live capture without rerunning the YouTube backfill.

#### Scenario: New stream grows the totals without a backfill

- **WHEN** a chatter sends messages during a live stream and later uses `!me`
  with no backfill rerun in between
- **THEN** their message total and attended-stream count include the new
  stream's activity

#### Scenario: Archive plus live never double-counts

- **WHEN** a chatter has imported archive history and new live messages
- **THEN** each message is counted exactly once, whether or not their identity
  is linked

#### Scenario: Totals are unchanged by linking

- **WHEN** an identity's totals are captured, the identity is merged into an
  account, and the totals are read again
- **THEN** the message total, attended-stream count and first-seen are identical

#### Scenario: Live-only chatter

- **WHEN** a chatter has no imported history but has live-captured messages
- **THEN** their stats derive from those messages, including first-seen
