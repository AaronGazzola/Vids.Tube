# Design

## Context

All YouTube-bound sends converge on two functions in `worker/lib/replies.ts`:

- `enqueueNightbotSend` — every command reply (`deliverReply`), `!ask`, `!me`,
  `!catchup`, and moment/wrap-up broadcast (`sendBroadcast`).
- `enqueueNightbotBridge` — the vids.tube → YouTube chat bridge only.

Both currently call `truncateForYoutube(text)` before pushing onto the shared
5.2 s-spaced queue. That single truncation is why long replies get cut off.

## Decisions

### Chunk at the send layer, not per-caller

The split belongs in `enqueueNightbotSend`, not in each command handler. One
implementation covers every current and future AI/command sender, and it keeps
the 400-char rule (a Nightbot transport constraint) out of business logic.

### Bridge is not chunked

`enqueueNightbotBridge` keeps single-message truncation. Bridged messages are
verbatim viewer chat; splitting one viewer's long line into three timed sends
would both read as spam on YouTube and starve command replies (which already
outrank bridged sends but share the same queue). A truncated bridge line is the
acceptable tradeoff; an original long reply is not.

### Chunk shape

`chunkForYoutube(text: string): string[]`:

- `text.length <= 400` → `[text]`, no marker.
- Otherwise split greedily on the last whitespace at or before the per-part
  content budget (`400 − markerWidth`, marker `" (n/m)"`), never mid-word; a
  single word longer than the budget is hard-split.
- Append ` (n/m)` to each part when the result has more than one part.
- Cap at `MAX_REPLY_CHUNKS = 3`. If content remains after the third part, the
  third part is ellipsis-truncated to fit — a bounded fallback, not silent loss,
  and unreachable for AI content given the 600-char budget below.
- Guarantee: no returned string exceeds 400 characters.

`enqueueNightbotSend` maps each chunk onto its own queue push, so parts keep the
existing spacing, retry, token-refresh, and reply-precedence behavior for free.
Distinct chunk text (different `(n/m)` suffix) avoids Nightbot's identical-message
dedupe.

### AI budget: 600, not the full 3-chunk ceiling

Three chunks allow ~1.17k chars, but a 1.2k-char chat bio is worse UX and three
sends per `!me` is heavy on the queue. Set a shared `MAX_AI_REPLY_CHARS = 600`
(prompt target "under ~550 characters", hard cap 600). 600 fits in two sends, so
the 3-chunk cap stays a pure safety net. Fixed non-AI strings (MVP line, thanks
line) keep their current wording and simply chunk if long.

## Risks

- **Queue occupancy:** a long reply now uses up to 3 slots (~15 s). Bounded by
  the 3-chunk cap and the 600-char AI budget (≈2 slots). Bridge unaffected.
- **Marker noise on borderline replies:** a 405-char reply becomes `(1/2)` +
  `(2/2)` for 5 chars of overflow. Acceptable; the alternative is losing the tail.
