## 1. Shared staleness threshold

- [ ] 1.1 Create a shared module (e.g. `lib/stream.ts`) exporting `STALE_MS = 60_000`
- [ ] 1.2 Replace the private `STALE_MS` in `app/layout.actions.ts` with an import from the shared module (no behavior change to `getLiveStreamAction`)

## 2. Per-session go-live in the ingest hook

- [ ] 2.1 In `app/api/ingest/live/route.ts`, fetch the channel's most-recent stream row (`id, status, last_seen_at`) and compute whether it is an ongoing session: `status === 'live'` AND `now - last_seen_at <= STALE_MS`
- [ ] 2.2 When it is an ongoing session, update only that row's `hls_path` and `last_seen_at` (keep `id` and `started_at`)
- [ ] 2.3 When there is no row, or the most-recent row is `ended`/`idle`, INSERT a new row with `status='live'`, fresh `started_at` and `last_seen_at`, and `hls_path`
- [ ] 2.4 When the most-recent row is a stale `live` row, set that orphaned row's `status` to `ended`, then INSERT a new session row as in 2.3
- [ ] 2.5 Remove the old reuse-the-latest-row logic and the `wasLive`-only `started_at` gating

## 3. Tests

- [ ] 3.1 Add an ingest unit/integration test: a second go-live after a prior `ended` session creates a new `stream.id`, and `chat_messages` from the prior session are not returned for the new id
- [ ] 3.2 Add a test for the reconnect case: a ready hook within `STALE_MS` of a `live` row reuses the same `id` and does not reset `started_at`
- [ ] 3.3 Add a test for the stale-`live` case: a ready hook after staleness ends the orphaned row and creates a new session row
- [ ] 3.4 Extend `tests/e2e/live-vod.spec.ts`: a new broadcast shows an empty live chat (no carryover from a prior session)
- [ ] 3.5 Extend `tests/e2e/live-vod.spec.ts`: two sequential broadcasts each produce a VOD whose chat replay shows only its own session's messages, with messages spread across the duration revealing progressively (not clustered at `t=0`)

## 4. Verification

- [ ] 4.1 Run `openspec-verify-change` for `fix-stream-session-chat-scope`
- [ ] 4.2 Run the unit + e2e test suites and confirm green
- [ ] 4.3 Manually verify against a live channel: end a stream, start a new one, confirm the new live chat is empty and the prior session's VOD replay is unchanged
