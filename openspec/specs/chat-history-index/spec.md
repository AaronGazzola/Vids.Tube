# chat-history-index Specification

## Purpose

Archive the channel's full YouTube chat history (public and owner-pasted
unlisted VODs) as raw per-message rows plus per-chatter aggregates keyed by
the YouTube author channel id, so identity features like !me can match live
chatters to their history without sign-in.

## Requirements

### Requirement: Raw YouTube chat archive

The system SHALL store the channel's YouTube chat history as raw per-message
rows (`youtube_chat_archive`): video id, replay item id (deduplicated per
video), author channel id, author display name, message text, and published
time — so any future metric (per-stream counts, streaks, most-active stream)
can be derived without re-downloading. Processed videos SHALL be tracked in
`youtube_vods` with their title and message count. Both tables SHALL be readable
only by the owner and written only by the service role.

#### Scenario: Messages archived losslessly

- **WHEN** the backfill processes a VOD with chat replay
- **THEN** each replayed message exists as an archive row with its author
  channel id, name, text, and timestamp, and the video's `youtube_vods` row
  records the count

#### Scenario: Replay-less video recorded

- **WHEN** a video has no chat replay
- **THEN** it still gets a `youtube_vods` row with zero messages so reruns skip
  it

### Requirement: Idempotent multi-source backfill

The system SHALL provide an owner-run backfill script that gathers video ids
from three sources — the channel's public uploads, distinct
`streams.youtube_video_id` values, and owner-pasted URLs in
`data/youtube-vod-urls.txt` (the path for unlisted VODs, which cannot be
enumerated automatically) — downloads each video's chat replay with yt-dlp, and
is idempotent: already-processed videos are skipped (unless forced), reruns pick
up only new videos or newly pasted URLs, and a failure on one video SHALL NOT
abort the rest (failures are summarized at the end).

#### Scenario: Rerun after adding an unlisted URL

- **WHEN** the owner pastes an unlisted VOD URL into `data/youtube-vod-urls.txt`
  and reruns the script
- **THEN** only that video is downloaded and archived; previously processed
  videos are skipped

#### Scenario: One bad video does not abort

- **WHEN** one video's replay download fails
- **THEN** the script continues with the remaining videos and lists the failure
  in its summary

### Requirement: Chatter aggregates

The system SHALL maintain `chatter_stats` — per YouTube author channel id: the
latest display name, total archived messages, number of videos attended, and
first/last seen timestamps — fully rebuilt from the archive at the end of each
backfill run. The key SHALL be the same author channel id carried by live
YouTube chat messages, so a live chatter's history is matched without any
sign-in.

#### Scenario: Aggregates rebuilt

- **WHEN** the backfill completes
- **THEN** every archived author has a `chatter_stats` row whose totals equal
  the archive's per-author counts, with the most recent display name

#### Scenario: Live chatter matches their history

- **WHEN** a live YouTube chat message arrives with an author channel id present
  in `chatter_stats`
- **THEN** that id keys directly into the chatter's aggregates with no linking
  step
