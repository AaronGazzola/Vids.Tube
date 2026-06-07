## Why

Each broadcast should have its own live chat and its own VOD chat replay. Today they don't: when a channel goes live, the ingest "ready" hook resurrects the channel's most-recent `streams` row instead of starting a new one, so the same `stream.id` is reused across separate broadcasts. The previous session's chat reappears in the new live stream, and — because the VOD created on offline stores that reused `source_stream_id` — multiple VODs end up sharing one chat set anchored to a `started_at` that no longer matches the recording. This is the live-side symptom of the structural defect already documented in Linear AZ-20 (root cause #2).

## What Changes

- **BREAKING (ingest behavior):** The go-live ingest hook creates a **new** `streams` row per broadcast session. It reuses the existing row **only** for a genuine reconnect — when the most-recent row is `status='live'` **and** its `last_seen_at` is within the staleness window. In every other case (no row / `ended` / `idle` / stale-`live`) it inserts a new row with a fresh `started_at` and `last_seen_at`.
- When a new session is started because the prior row was stale-`live` (ingest crashed, offline hook never fired), that orphaned row is flipped to `status='ended'` so live-state reads stay clean.
- The staleness threshold (`STALE_MS`, currently a private constant in `app/layout.actions.ts`) moves to a shared module so the ingest route and the read path use one source of truth.
- As a consequence of one-row-per-session, each VOD's `source_stream_id` is unique and `stream.started_at` aligns to that recording's start, so VOD chat replay shows only that session's messages, correctly offset on the VOD timeline.
- No database schema/migration change is required; the `chat_messages.stream_id` FK and `videos.source_stream_id` FK already scope correctly once row reuse stops.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `stream-pipeline`: the live-state hook now starts a new stream session row per broadcast rather than reusing the channel's latest row; adds reconnect-vs-new-session and orphaned-stale-row semantics.
- `live-chat`: live chat is scoped to a single broadcast session — a new broadcast starts with an empty chat and never shows a prior session's messages.
- `vod-chat-replay`: a VOD's chat replay contains only its own session's messages, anchored to that session's `started_at`, revealed progressively across the VOD timeline.

## Impact

- **Ingest routes:** `app/api/ingest/live/route.ts` (new-session vs reconnect logic, orphan cleanup); `app/api/ingest/offline/route.ts` (unchanged behavior, but now ends a per-session row).
- **Shared constant:** new shared `STALE_MS` module (e.g. `lib/`), consumed by `app/layout.actions.ts` (`getLiveStreamAction`) and the ingest live route.
- **Read/replay paths (no logic change, validated by tests):** `getLiveStreamAction`, `useLiveStream`/`useLiveChat` (`app/layout.hooks.tsx`), `getStreamChatReplayAction` (`app/watch/[videoId]/page.actions.ts`), `lib/chat-replay.ts`.
- **Tests:** ingest unit/integration test (second go-live after an ended/stale session → new `stream.id`, no chat carryover); extend `tests/e2e/live-vod.spec.ts` for non-carryover live chat and correct per-session VOD replay (messages spread across duration, not clustered at `t=0`).
- **Related Linear:** resolves AZ-20 structural root cause #2 + timeline anchoring (leaving its collapsible-panel UI as a separate follow-up); unblocks AZ-39 (ticket-gated chat) which assumes per-session chat scoping.
