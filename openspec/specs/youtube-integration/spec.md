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
returning a page of normalized messages (`{ author, authorChannelId, text, publishedAt }`), a
`nextPageToken`, and the `pollingIntervalMillis`. A failed request SHALL raise an error carrying
the HTTP status and the reason YouTube gave, so a caller can tell a chat that has ended from a
request that failed without inspecting message text.

The worker SHALL provide `worker/lib/youtube-chat.ts` that imports the shared client via
`@/lib/youtube` and loops over pages, waiting at least `pollingIntervalMillis` between requests
and yielding messages tagged `origin: 'youtube'`.

The poller SHALL continue for as long as the broadcast is engaged. A failed page read SHALL NOT
end the poller: it SHALL wait and retry with the page token it already held, so pages resume
where they stopped rather than from the present. The wait SHALL grow on repeated failure up to a
ceiling and SHALL return to its shortest interval on the first success. A page carrying no
`nextPageToken` SHALL be retried with the existing token rather than treated as the end of chat.

The poller SHALL end only when the chat itself has ended, identified by the status and reason on
the raised error, or when its caller signals it to stop. The poller SHALL accept that stop signal
and SHALL check it while waiting between pages, not only when a message is yielded, so a
broadcast whose chat is silent can still be released.

The scoring consumer is out of scope.

#### Scenario: Chat pages are read in order without busy-polling

- **WHEN** the worker poller runs for a live broadcast's `liveChatId`
- **THEN** it yields normalized messages tagged `origin: 'youtube'`, advances by
  `nextPageToken`, and waits at least `pollingIntervalMillis` between pages

#### Scenario: No live chat yet

- **WHEN** the broadcast has no `activeLiveChatId` (not live)
- **THEN** the poller yields nothing and does not error

#### Scenario: A failed read is retried rather than ending capture

- **WHEN** a page read fails for a reason other than the chat having ended
- **THEN** the poller waits, requests the same page again with the token it already held, and
  continues yielding messages once the request succeeds

#### Scenario: Repeated failure backs off and recovers

- **WHEN** page reads fail several times in a row and then succeed
- **THEN** the wait between attempts grows with each failure up to a ceiling, and returns to its
  shortest interval once a read succeeds

#### Scenario: A page without a next token does not end the poller

- **WHEN** a page is returned carrying no `nextPageToken`
- **THEN** the poller keeps the token it already had and polls again, rather than returning

#### Scenario: A chat that has ended stops the poller

- **WHEN** a read fails because the live chat has ended or cannot be found
- **THEN** the poller returns without further retries

#### Scenario: A silent chat can still be stopped

- **WHEN** the caller signals the poller to stop while it is waiting between pages and no message
  has arrived
- **THEN** the poller returns rather than waiting for a message that may never come

### Requirement: Read-layer verification

The system SHALL include a smoke check (`scripts/verify-youtube.ts`, run via
`doppler run -- tsx`) that exercises the metrics client against a public video and the
chat client against a public live broadcast, confirming the read layer works end to
end with only the API key.

#### Scenario: Smoke check reports metrics and chat

- **WHEN** the smoke check runs against a public live broadcast
- **THEN** it prints the metrics (likes/subs/viewers, `activeLiveChatId`) and a sample
  of normalized chat messages

