# youtube-integration Specification

## Purpose
TBD - created by archiving change add-youtube-integration. Update Purpose after archive.
## Requirements
### Requirement: API-key-only read access to the owner's public broadcast

The system SHALL read YouTube data using a single API key (`YOUTUBE_API_KEY`, stored
in Doppler) and SHALL NOT require OAuth. The key SHALL be used only for read-only
access to **public** broadcast data (metrics and live chat). No write operations and
no access to private/unlisted broadcasts are in scope.

#### Scenario: Reads succeed with only an API key

- **WHEN** the metrics and live-chat reads run for a public broadcast with a valid
  `YOUTUBE_API_KEY`
- **THEN** they return data without any OAuth token

#### Scenario: No secret is committed

- **WHEN** the integration is configured
- **THEN** `YOUTUBE_API_KEY` lives in Doppler, not in the repository

### Requirement: Stream-to-YouTube-video mapping

The system SHALL let the channel owner associate a live Vids.Tube stream with its
YouTube counterpart by storing `youtube_video_id` and `youtube_channel_id` on the
`streams` row (both nullable). The owner SHALL be able to set and clear this mapping
from studio by providing a YouTube video URL or id, which is normalized before
storage. Existing stream behavior SHALL be unchanged when the mapping is absent.

#### Scenario: Owner sets the YouTube video for a stream

- **WHEN** the owner submits a YouTube video URL for their live stream from
  `/studio/overlay`
- **THEN** the URL is normalized to a video id and stored as
  `streams.youtube_video_id` (with `youtube_channel_id` resolved from the broadcast)

#### Scenario: Owner clears the mapping

- **WHEN** the owner clears the YouTube video field
- **THEN** `youtube_video_id`/`youtube_channel_id` are nulled and reads stop for that
  stream

#### Scenario: A non-owner cannot set the mapping

- **WHEN** a non-owner attempts to set the mapping
- **THEN** the action is rejected by the owner guard and no columns change

### Requirement: Shared metrics read client

The system SHALL provide a shared `lib/youtube.ts` exposing `parseVideoId`,
`fetchVideoData(videoId)`, and `fetchSubs(channelId)`. `fetchVideoData` SHALL return
`likeCount`, `concurrentViewers`, `channelId`, `activeLiveChatId`, and the broadcast
state from one `videos.list` call; `fetchSubs` SHALL return the subscriber count. The
same `activeLiveChatId` from `fetchVideoData` SHALL be the value used to read chat, so
metrics and chat share one lookup.

#### Scenario: Metrics are returned for a public video

- **WHEN** `fetchVideoData` is called with a public video id
- **THEN** it returns the like count, concurrent viewers (0 when off-air),
  `channelId`, and `activeLiveChatId` (present only while live)

#### Scenario: URL forms are accepted

- **WHEN** `parseVideoId` receives a watch URL, a `youtu.be` URL, a `/live/` URL, or a
  raw 11-character id
- **THEN** it returns the canonical video id

### Requirement: Shared live-chat read client and worker poller

The system SHALL provide `fetchLiveChatPage(liveChatId, pageToken?)` in `lib/youtube.ts`
returning a page of normalized messages (`{ author, authorChannelId, text,
publishedAt }`), a `nextPageToken`, and the `pollingIntervalMillis`. The worker SHALL
provide `worker/lib/youtube-chat.ts` that imports the shared client via `@/lib/youtube`
and loops over pages, waiting at least `pollingIntervalMillis` between requests and
yielding messages tagged `origin: 'youtube'`. The scoring consumer is out of scope.

#### Scenario: Chat pages are read in order without busy-polling

- **WHEN** the worker poller runs for a live broadcast's `liveChatId`
- **THEN** it yields normalized messages tagged `origin: 'youtube'`, advances by
  `nextPageToken`, and waits at least `pollingIntervalMillis` between pages

#### Scenario: No live chat yet

- **WHEN** the broadcast has no `activeLiveChatId` (not live)
- **THEN** the poller yields nothing and does not error

### Requirement: Read-layer verification

The system SHALL include a smoke check (`scripts/verify-youtube.ts`, run via
`doppler run -- tsx`) that exercises the metrics client against a public video and the
chat client against a public live broadcast, confirming the read layer works end to
end with only the API key.

#### Scenario: Smoke check reports metrics and chat

- **WHEN** the smoke check runs against a public live broadcast
- **THEN** it prints the metrics (likes/subs/viewers, `activeLiveChatId`) and a sample
  of normalized chat messages

