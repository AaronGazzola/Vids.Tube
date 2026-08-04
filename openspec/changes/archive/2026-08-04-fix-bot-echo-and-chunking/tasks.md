# Tasks: fix the bot echo and the chunk budget

## 1. Normalisation, shared by both ends

- [x] 1.1 Create `lib/bot-echo.ts` exporting `normaliseForEcho(text)` which strips
  zero-width characters, collapses whitespace, folds case and trims, and
  `echoKey(text)` which returns the normalised prefix used for comparison,
  truncated to a length shorter than the platform limit.
- [x] 1.2 Export `ECHO_PREFIX_CHARS` as a named constant with a comment explaining
  why it is shorter than the platform's own limit.
- [x] 1.3 Add `tests/unit/bot-echo.test.ts` covering: a truncated echo matches its
  original; a zero-width-padded echo matches; case and whitespace differences
  match; a different message does not match; an empty message yields an empty key.

## 2. The send budget

- [x] 2.1 In `worker/lib/replies.ts`, change `MAX_YOUTUBE_CHARS` from 400 to 200
  and confirm by reading `chunkForYoutube` that the continuation marker is
  counted inside the budget rather than appended beyond it.
- [x] 2.2 Add tests to `tests/unit/nightbot-chunking.test.ts` asserting every
  chunk of a long reply is within 200 characters including its marker, that no
  chunk ends mid-word, and that a short reply is sent unmarked.

## 3. Recognising the echo

- [x] 3.1 Change `rememberSent` to store `echoKey(text)` rather than the exact
  string, keeping the bounded memory.
- [x] 3.2 Change `consumeSelfEcho` to compare `echoKey(incoming)` against the
  stored keys, removing the entry on the first match so a genuinely repeated
  message is not swallowed forever.
- [x] 3.3 Confirm by reading `worker/jobs/score.ts` that a recognised echo is
  dropped before the chat row is written, so nothing is stored under the Nightbot
  identity.

## 4. Verification

- [x] 4.1 Run `npx tsc --noEmit`, `npm run lint` and `npx vitest run`.
- [x] 4.2 Measured against production 3-Aug-2026: 12 bot rows, all authored
  VidsBot, none under @nightbot, and 2 messages stored twice on the same
  broadcast. Most historical duplicates went with the three site recordings when
  they were replaced by their YouTube copies.

## 5. Cleanup, after the fix is seen working

- [x] 5.1 On-stream confirmation and the duplicate cleanup raised as AZ-220,
  covering a reply appearing once, a long reply keeping its marker, a genuine
  Nightbot message surviving, and the cleanup running only after the fix is seen
  working. Not left as a task here.
