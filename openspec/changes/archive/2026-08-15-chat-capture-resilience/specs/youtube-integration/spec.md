## MODIFIED Requirements

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
