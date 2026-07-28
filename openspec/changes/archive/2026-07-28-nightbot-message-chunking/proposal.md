# Split long Nightbot sends into multiple messages

## Why

Nightbot's `channel/send` caps each message at 400 characters, so today the
worker truncates every YouTube-bound send to 400 chars on a word boundary
(`truncateForYoutube` in `worker/lib/replies.ts`). Long replies — `!ask`
answers, `!me` bios, `!catchup` and wrap-up summaries — get cut off mid-thought
on stream, and the mention prefix (`@viewer `) eats into the same 400 budget so
the visible answer is even shorter than its own cap.

Truncating is the wrong layer: the overflow is meaningful content the viewer
asked for. Splitting one logical reply across multiple ≤400-char Nightbot sends
preserves it. Because every command reply, AI answer, and moment broadcast
already funnels through one function (`enqueueNightbotSend`), the split lives in
exactly one place and covers all of them.

And because a reply can now span more than 400 chars, the AI generators that
were artificially told to stay "under ~350 characters" and hard-sliced to 400
can be given more room — the `!me` bio and the other AI summaries can be a
little fuller without being cut off.

## What Changes

- **Chunk instead of truncate at the send choke point.** `worker/lib/replies.ts`
  gains `chunkForYoutube(text): string[]` that splits text longer than 400 chars
  into ≤400-char parts on whitespace boundaries, appends a ` (n/m)` continuation
  marker to each part when there is more than one, and caps the reply at
  `MAX_REPLY_CHUNKS = 3` parts (ellipsis-truncating the last part if content
  remains). `enqueueNightbotSend` enqueues each chunk as its own queued send, so
  parts inherit the existing 5.2 s spacing and yield-to-replies ordering. Single
  messages (≤400) are unchanged — no marker.
- **Bridge stays single-message.** `enqueueNightbotBridge` keeps the existing
  `truncateForYoutube` single-message truncation: bridged messages are verbatim
  viewer chat, and multi-part bridging would flood the queue and starve command
  replies. Chunking applies only to command/AI/moment replies.
- **Give the AI generators more room.** With multi-part delivery in place, raise
  the AI content budget from ~350 to a shared `MAX_AI_REPLY_CHARS = 600` (fits in
  two sends) in `worker/lib/me-command.ts` (`!me` bio), `worker/lib/ask-command.ts`
  (`!ask` answer), `worker/lib/catchup-command.ts` (`!catchup` summary), and
  `worker/lib/moments.ts` (wrap-up/useful-info summaries): update both the prompt
  character targets and the hard slice/truncate caps.
- **Cover the chunker with unit tests** in `tests/unit/` — short/at-limit/over-
  limit/over-cap inputs, marker formatting, and that no chunk exceeds 400.

## Capabilities

### Modified Capabilities

- `bot-chat-replies`: the Nightbot send queue splits an over-length reply into up
  to 3 word-boundary chunks with `(n/m)` markers instead of truncating to 400; the
  bridge still sends a single truncated message.
- `ai-commands`: `!ask` and `!catchup` may produce answers/summaries up to ~600
  characters, delivered across multiple Nightbot messages when needed.
- `me-command`: the `!me` bio cap rises from 400 to ~600 characters.
- `bot-moments`: wrap-up and useful-info broadcasts may run up to ~600 characters
  and are chunked on delivery.

## Impact

- Worker only — no schema, no client changes. The worker is restarted before each
  stream, so the change is live from the next stream.
- A single long reply now occupies up to three 5.2 s send slots (~15 s). The
  3-chunk cap and the ~600-char AI budget (≈2 sends) bound this; bridged chat is
  unaffected. Live end-to-end confirmation happens at the next stream.
