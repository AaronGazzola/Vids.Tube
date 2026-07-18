## ADDED Requirements

### Requirement: Live-accruing stats

The system SHALL keep `!me` stats current from live-captured chat without
requiring the YouTube backfill to rerun: message totals SHALL combine the
`chatter_stats` archive with `chat_messages` rows recorded after the
chatter's archive watermark (`last_seen_at`; all rows when the chatter has no
archive entry), streams attended SHALL grow by the distinct live streams the
chatter spoke in after the watermark, the identity's own vids.tube messages
SHALL count toward the total, and first-seen SHALL fall back to the earliest
live message when no archive entry exists.

#### Scenario: New stream grows the totals without a backfill

- **WHEN** a chatter sends messages during a live stream and later uses `!me`
  with no backfill rerun in between
- **THEN** their message total and attended-stream count include the new
  stream's activity

#### Scenario: Archive plus live never double-counts

- **WHEN** a chatter has archived history and new live messages
- **THEN** only messages after the archive watermark are added to the
  archived total

#### Scenario: Live-only chatter

- **WHEN** a chatter has no archive entry but has live-captured messages
- **THEN** their stats derive entirely from `chat_messages`, including
  first-seen
