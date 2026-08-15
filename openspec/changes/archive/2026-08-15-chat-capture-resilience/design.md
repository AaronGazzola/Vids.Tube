## Context

The worker reads YouTube chat through one async generator, `pollYoutubeChat`, started once per
broadcast by `consumeYoutube()` in `worker/jobs/score.ts`. Site chat is read separately by the
main scoring loop and is unaffected by any of this, which is why the loss on 9-Aug-2026 and
10-Aug-2026 was partial rather than total.

Evidence was taken from the production database on 12-Aug-2026: 9 stored against 20 in the
replay on 9-Aug-2026, 7 against 13 on 10-Aug-2026.

## Decisions

### The retry lives inside the poller, not around it

A supervisor wrapping `consumeYoutube()` would restart the generator from scratch, and a fresh
`liveChatMessages.list` with no page token returns only recent messages. Everything that arrived
during the outage would be skipped. Keeping the page token across the retry resumes the stream of
pages where it stopped, so a transient failure costs latency rather than messages.

### Terminal is decided on YouTube's reason, not on a string

`fetchLiveChatPage` currently throws `new Error("YouTube liveChatMessages.list failed: 403 ...")`.
Deciding whether to retry by matching text in that message would break the first time YouTube
changed its wording. The client instead raises a `YouTubeApiError` carrying `status` and the
`reason` from the first entry of the error payload.

Terminal, meaning the poller returns: HTTP 404, or reason `liveChatEnded` or `liveChatNotFound`.
The chat is genuinely over and no amount of retrying brings it back.

Transient, meaning the poller backs off and retries with the same token: everything else, quota
exhaustion included. Quota will not recover before the broadcast ends, so those retries are
futile, but they are also harmless, and the capture indicator will show the reader as stale for
the rest of the broadcast, which is the true state and better than a silent stop.

Backoff doubles from 2 seconds to a 60 second ceiling and resets on the first success.

### A missing page token is retried, not obeyed

The live chat endpoint returns a `nextPageToken` on every page of a running chat. Its absence is
an anomaly, not an announcement. Treating it as the end of chat is one of the two ways capture
dies today, so the poller keeps its existing token and polls again. A chat that has truly ended
is caught by the terminal reasons above.

### The poller must be stoppable, or the worker hangs

`worker/jobs/score.ts:890` sets `stopped = true` and then awaits the reader task before the
broadcast can be released and the post-broadcast pass can run. The reader ends today only because
it stops paginating. A poller that retries forever would never return, so the worker would hold
the lock and never finish the broadcast.

The poller therefore takes a `shouldStop: () => boolean`, checked before each request and again
after each wait. Checking it only when a message is yielded would not be enough: a quiet chat
yields nothing, which is exactly when the hang would bite.

### Liveness is the last successful read, not the last message

Watching for messages would flag every quiet stretch of a real broadcast as a fault, and quiet
chat is normal. A successful page read proves the reader is working whether or not anyone spoke,
so each success stamps `streams.youtube_chat_polled_at`.

The stamp is written at most once every 15 seconds rather than on every page, because the polling
interval YouTube asks for can be as low as one second and a write per page is a write per second
per broadcast for no extra truth.

### Completeness cannot be measured without knowing how a message arrived

Live capture and the replay top-up both insert into `chat_messages` with the same shape, and
nothing records insertion time, so after a top-up the two are indistinguishable. Without that,
"how much did live capture get" is unanswerable for every broadcast already repaired.

`chat_messages.captured_via` records `live` or `replay`, defaulting to `live`. Existing rows keep
the default, which is wrong for rows the top-up inserted historically and is accepted: the column
becomes trustworthy from this change forward, and the report says so rather than implying the
back history is sound.

### The measurement is a report, not a stored figure

A stored completeness figure would go stale the moment a top-up ran. The report computes from
`chat_messages` and `youtube_chat_archive` each time it runs, so it cannot disagree with the
data. Whether a broadcast is settled is a matter for the next change, and no flag for it is
introduced here.

## Risks

- The retry loop is the piece that can hang the worker. It is covered by a unit test that drives
  the poller with an injected fetch and asserts it returns when the stop signal flips while it is
  waiting between pages.
- Marking historical rows `live` by default overstates what live capture achieved on repaired
  broadcasts. The report prints the count of broadcasts repaired before this change alongside its
  figures so the overstatement is visible rather than assumed away.
