## 1. Tell a chat that ended from a request that failed

- [x] 1.1 In `lib/youtube.ts`, export `class YouTubeApiError extends Error` carrying `status:
      number` and `reason: string | null`, and throw it from `fetchLiveChatPage` in place of the
      current `new Error(...)`, reading the reason from `error.errors[0].reason` of the parsed
      body and falling back to `null` when the body is not the expected shape.
- [x] 1.2 In `worker/lib/youtube-chat.ts`, add `export function isChatEnded(e: unknown): boolean`
      returning true for a `YouTubeApiError` with `status === 404` or `reason` of `liveChatEnded`
      or `liveChatNotFound`, and false for everything else including a non-`YouTubeApiError`.

## 2. The poller survives a failed read

- [x] 2.1 Change `pollYoutubeChat` in `worker/lib/youtube-chat.ts` to take
      `(liveChatId, opts: { shouldStop: () => boolean; onPage?: () => void })`.
- [x] 2.2 Wrap the `fetchLiveChatPage` call in a try/catch. On `isChatEnded`, return. On any
      other error, wait the current backoff and `continue` without changing `pageToken`, so the
      retry asks for the same page rather than jumping to the present.
- [x] 2.3 Hold backoff in a local starting at 2000ms, doubling on each consecutive failure to a
      60000ms ceiling, and reset to 2000ms on the first successful read.
- [x] 2.4 Replace the `if (!page.nextPageToken) return;` early exit: assign `pageToken` only when
      `page.nextPageToken` is present, and otherwise fall through to the wait and poll again with
      the token already held.
- [x] 2.5 Check `opts.shouldStop()` at the top of each loop iteration and again immediately after
      each wait, returning when it is true. This is what lets a broadcast with a silent chat be
      released, since `worker/jobs/score.ts` awaits this task before finishing.
- [x] 2.6 Call `opts.onPage?.()` after each successful read, before yielding its messages, so the
      caller learns the reader is alive whether or not the page carried anything.

## 3. Wire it into the worker

- [x] 3.1 In `consumeYoutube` in `worker/jobs/score.ts`, pass `{ shouldStop: () => stopped }` to
      `pollYoutubeChat`, so the existing `stopped` flag set in the `finally` at line 890 now ends
      the poller rather than waiting for a message that may never arrive.
- [x] 3.2 Pass an `onPage` that updates `streams.youtube_chat_polled_at` for `stream.id`, guarded
      by a local timestamp so no write is issued within 15 seconds of the previous one.

## 4. Record how a message arrived

- [x] 4.1 Create a migration adding `streams.youtube_chat_polled_at timestamptz` and
      `chat_messages.captured_via text not null default 'live'` constrained to `'live'` or
      `'replay'`, with a comment on `captured_via` stating that rows predating the column carry
      the default and so overstate live capture on repaired broadcasts.
- [x] 4.2 Check `supabase/migrations` against the remote before pushing, since `npx supabase db
      push` applies every pending migration and a parallel session's migration was carried into
      production this way on 14-Aug-2026. Then push and regenerate `supabase/types.ts`.
- [x] 4.3 In `scripts/topup-youtube-chat.ts`, set `captured_via: "replay"` on the rows it builds
      in `main`, leaving the live insert in `worker/jobs/score.ts` on the default.

## 5. Show a stalled reader

- [x] 5.1 In `lib/worker-status.ts`, add `CHAT_CAPTURE_STALE_MS` and
      `isChatCaptureFresh(lastPolledAt, nowMs?, staleMs?)`, matching the shape of
      `isWorkerFresh`. Set the window to 45_000: a healthy reader stamps at most every 15
      seconds, so three missed stamps is a stall. Deliberately narrower than the 60000ms backoff
      ceiling, because reads failing long enough to reach that ceiling are a stall and should be
      shown as one.
- [x] 5.2 Return `youtube_chat_polled_at` for the live broadcast from the action in
      `app/(app)/live/broadcast.actions.ts` that already supplies the worker heartbeat.
- [x] 5.3 In the "Local worker" section of `app/(app)/live/settings-tab.tsx` at line 1389, add a
      second indicator for YouTube chat capture, shown only when a broadcast is live and carries a
      YouTube video, reading Working or Stalled from `isChatCaptureFresh`. Keep it separate from
      the worker indicator: a running worker with a dead reader is the condition that went
      unnoticed on 9-Aug-2026.

## 6. Measure it

- [x] 6.1 Add `scripts/chat-completeness.ts` printing one line per broadcast carrying a
      `youtube_video_id`: the date, the count of `chat_messages` with `captured_via = 'live'` and
      `origin` in `youtube`/`bot`, the count of `youtube_chat_archive` rows for the video, the
      total stored, and the shortfall of live capture against the archive.
- [x] 6.2 Report a broadcast with no archive rows as "replay not fetched" rather than folding it
      in as complete, and print a trailing note counting broadcasts whose completion record
      predates `captured_via`, stating their live figures are overstated.
- [x] 6.3 Add `"chat:completeness": "doppler run -- tsx scripts/chat-completeness.ts"` to
      `package.json` scripts.

## 7. Prove it

- [x] 7.1 Add `tests/unit/youtube-chat-poller.test.ts` driving `pollYoutubeChat` with a stubbed
      `fetchLiveChatPage`, asserting: a transient failure is retried with the same page token; the
      backoff doubles then resets after a success; a page with no `nextPageToken` polls again
      rather than returning; a `liveChatEnded` error returns; and the poller returns when
      `shouldStop` flips while it is waiting and no message has been yielded.
- [x] 7.2 Add unit coverage for `isChatEnded` over a 404, a `liveChatEnded` reason, a 500, and a
      plain `Error`, and for `isChatCaptureFresh` at either side of its window and with a null.
- [x] 7.3 Run `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`,
      typecheck, lint and a production build.

## 8. Land it

- [x] 8.1 Run `openspec validate --strict` and archive the change.
- [x] 8.2 Add a line to `docs/runbooks/next-broadcast-checklist.md` to watch the capture indicator
      during the broadcast and run `npm run chat:completeness` after it, since neither can be
      proven without a live broadcast.
