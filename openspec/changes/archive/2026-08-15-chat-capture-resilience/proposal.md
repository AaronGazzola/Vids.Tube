## Why

YouTube chat capture stops part-way through a broadcast and nothing notices. On 9-Aug-2026 it
stopped at 13:58 of a broadcast that ran to 14:59, and about an hour of chat was never stored.
The worker kept renewing its lock, heartbeating, scoring and answering commands the whole time,
so every signal the app watches said the broadcast was healthy.

Two paths end capture. A failed page read rejects the generator, and the rejection is swallowed
by a `catch` that only logs, at `worker/jobs/score.ts:773`. A page carrying no `nextPageToken`
returns from the generator normally and silently, at `worker/lib/youtube-chat.ts:46`. Neither
path retries, and nothing restarts the reader for the rest of the broadcast.

The loss is then invisible. Chat scoring runs on partial chat, so points and credits are
under-awarded; someone who spoke only during the dead window gets no membership from that
broadcast; the per-broadcast banner metrics read low with no sign that they are wrong. No
per-broadcast comparison of what was captured live against what the YouTube replay holds exists,
which is why three broadcasts passed before the problem was noticed at all.

This change stops the loss and makes it measurable. Merging the replay on a schedule, and what a
broadcast must satisfy before its chat is considered settled, are deliberately not here: they are
the next change, and they are worth far less until capture stops failing and the measurement
exists to prove it.

## What Changes

- The YouTube chat poller retries a failed page read instead of ending, holding its page token so
  it resumes where it stopped rather than jumping to the present. A page with no `nextPageToken`
  is retried rather than treated as the end of chat.
- Only a chat that has genuinely ended stops the poller. The shared read client raises a typed
  error carrying the HTTP status and YouTube's reason, so terminal is told from transient on the
  reason rather than by matching text in a message.
- The poller takes a stop signal and checks it while waiting, not only when a message arrives.
  Without this the worker would never release a broadcast, because `worker/jobs/score.ts:890`
  awaits the reader before finishing.
- Every successful page read stamps the broadcast, so the app can show that chat capture is
  alive. Liveness is the last successful read, not the last message, because a quiet chat is not
  a fault.
- A stored chat message records whether it arrived from live capture or from the replay, which is
  what makes completeness measurable at all.
- A report states, per broadcast, how many messages were captured live, how many the replay
  holds, and how many are stored once both are accounted for.

## Capabilities

### New Capabilities
- `chat-capture-health`: capture liveness is recorded and visible while a broadcast runs, and
  completeness is measurable per broadcast afterwards.

### Modified Capabilities
- `youtube-integration`: the worker poller survives a failed read and stops only on a chat that
  has ended.

## Impact

- `lib/youtube.ts` gains a typed API error; `worker/lib/youtube-chat.ts` gains the retry loop and
  the stop signal; `worker/jobs/score.ts` passes the signal and stamps each read.
- A migration adding `streams.youtube_chat_polled_at` and `chat_messages.captured_via`.
- `scripts/topup-youtube-chat.ts` marks what it inserts as coming from the replay.
- A new `scripts/chat-completeness.ts`, and the capture indicator on the Settings tab of `/live`.
- No change to how or when the post-broadcast pass runs.
