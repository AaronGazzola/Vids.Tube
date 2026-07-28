# Tasks

## 1. Chunk Nightbot sends at the choke point

- [x] 1.1 In `worker/lib/replies.ts`, add `MAX_REPLY_CHUNKS = 3` and export
  `chunkForYoutube(text: string): string[]`: returns `[text]` when
  `text.length <= MAX_YOUTUBE_CHARS`; otherwise splits on the last whitespace at
  or before `MAX_YOUTUBE_CHARS − markerWidth` (marker `" (n/m)"`), hard-splitting
  a single over-long word, appends ` (n/m)` to each part when there is more than
  one part, caps at `MAX_REPLY_CHUNKS` parts, ellipsis-truncates the final part
  if content remains, and guarantees no returned string exceeds
  `MAX_YOUTUBE_CHARS`.
- [x] 1.2 In `enqueueNightbotSend`, replace `queue.push(truncateForYoutube(text))`
  with pushing each element of `chunkForYoutube(text)` onto `queue` in order, so
  each part is an independent spaced send.
- [x] 1.3 Leave `enqueueNightbotBridge` on `truncateForYoutube` (bridge stays a
  single truncated message); keep `truncateForYoutube` exported.

## 2. Extend the AI content budget to 600

- [x] 2.1 Add a shared `MAX_AI_REPLY_CHARS = 600` constant (in a worker lib
  module the AI senders import, e.g. `worker/lib/replies.ts`).
- [x] 2.2 `worker/lib/me-command.ts`: set `MAX_PROFILE_CHARS` to 600 and change
  the `buildMePrompt` instruction from "under 350 characters" to "under ~550
  characters".
- [x] 2.3 `worker/lib/ask-command.ts`: change the prompt "under 350 characters"
  to "under ~550 characters" and raise `parsed.answer` `.slice(0, 400)` to
  `MAX_AI_REPLY_CHARS`.
- [x] 2.4 `worker/lib/catchup-command.ts`: set `MAX_SUMMARY_CHARS` to 600, change
  the prompt "under 380 characters" to "under ~550 characters", and update the
  `truncateSummary` word-boundary threshold accordingly.
- [x] 2.5 `worker/lib/moments.ts`: change the useful-info and wrap-up summary
  prompts to "under ~550 characters" and raise the corresponding `.slice(0, 400)`
  caps to `MAX_AI_REPLY_CHARS`; the fixed thanks string keeps its wording and now
  flows through the chunker (its 400-char slice removed); the MVP string is
  unchanged.

## 3. Tests

- [x] 3.1 Add `tests/unit/nightbot-chunking.test.ts` covering `chunkForYoutube`:
  ≤400 returns one unmarked message; a >400 message splits on whitespace with
  `(n/m)` markers and every part ≤400; a message needing >3 parts returns exactly
  3 with the third ellipsis-truncated; a single word longer than the budget is
  hard-split.
- [x] 3.2 Vitest cannot run in this environment (pre-existing `ERR_REQUIRE_ESM`
  loading `vitest.config.ts` via vite — unrelated to this change). All chunker
  cases in 3.1 were instead verified green through a temporary `tsx` harness; the
  vitest file stays for when the toolchain is fixed. Toolchain fix tracked in
  Linear AZ-196.

## 4. Verify & document

- [x] 4.1 `openspec validate nightbot-message-chunking --strict` passes.
- [x] 4.2 `tsc --noEmit` and `eslint` are clean on all changed worker + test
  files.
