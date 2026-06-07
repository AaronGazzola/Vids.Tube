## 1. Shared staleness threshold

- [x] 1.1 Create a shared module (`lib/stream.ts`) exporting `STALE_MS = 60_000`
- [x] 1.2 Replace the private `STALE_MS` in `app/layout.actions.ts` with an import from the shared module (no behavior change to `getLiveStreamAction`)

## 2. Per-session go-live in the ingest hook

- [x] 2.1 In `app/api/ingest/live/route.ts`, fetch the channel's most-recent stream row (`id, status, last_seen_at`) and compute the session decision via `decideGoLive` (`lib/stream.ts`): ongoing = `status === 'live'` AND `now - last_seen_at <= STALE_MS`
- [x] 2.2 When it is an ongoing session, update only that row's `hls_path` and `last_seen_at` (keep `id` and `started_at`)
- [x] 2.3 When there is no row, or the most-recent row is `ended`/`idle`, INSERT a new row with `status='live'`, fresh `started_at` and `last_seen_at`, and `hls_path`
- [x] 2.4 When the most-recent row is a stale `live` row, set that orphaned row's `status` to `ended`, then INSERT a new session row as in 2.3
- [x] 2.5 Remove the old reuse-the-latest-row logic and the `wasLive`-only `started_at` gating

## 3. Tests

- [x] 3.1 Unit test (`tests/unit/stream-session.test.ts`): `decideGoLive` returns `new` after a prior `ended` session; e2e asserts the new stream id differs and its chat is empty (no carryover)
- [x] 3.2 Unit + e2e for the reconnect case: a ready hook within `STALE_MS` of a `live` row reuses the same `id` and does not reset `started_at`
- [x] 3.3 Unit test for the stale-`live` case: `decideGoLive` returns `new-after-stale` (orphan ended, new session row created)
- [x] 3.4 Extend `tests/e2e/live-vod.spec.ts`: a new broadcast shows an empty live chat (no carryover from a prior session)
- [ ] 3.5 Extend `tests/e2e/live-vod.spec.ts`: two sequential broadcasts each produce a VOD whose chat replay shows only its own session's messages, spread across the duration (revealing progressively, not clustered at `t=0`)

## 4. Verification

- [x] 4.1 `openspec validate fix-stream-session-chat-scope --strict` passes
- [ ] 4.2 Run the unit + e2e test suites and confirm green (NOTE: local `vitest` invocation is broken by a pre-existing `ERR_REQUIRE_ESM` in `std-env`, unrelated to this change; e2e requires `doppler` + a running dev server + remote DB)
- [ ] 4.3 Manually verify against a live channel: end a stream, start a new one, confirm the new live chat is empty and the prior session's VOD replay is unchanged
