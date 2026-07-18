## 1. Token manager

- [x] 1.1 `worker/lib/nightbot-token.ts`: in-memory cache seeded from
  `NIGHTBOT_CHANNEL_SEND_TOKEN` / `NIGHTBOT_REFRESH_TOKEN` /
  `NIGHTBOT_TOKEN_EXPIRES_AT`; `getNightbotToken()` returns the cached token,
  refreshing first when expiry is unknown or < 5 days away
  (`RENEW_AHEAD_MS`), returning `null` when neither a token nor refresh
  materials exist; `forceNightbotRefresh()` refreshes unconditionally; both
  share a 1-hour failure backoff. Refresh = `POST
  https://api.nightbot.tv/oauth2/token` form-encoded
  (`grant_type=refresh_token`, `refresh_token`, `client_id`,
  `client_secret`); on success update cache + `process.env` and persist all
  three values with `execFile("doppler", ["secrets","set", …, "--silent"])`
  (cwd = repo root), logging persist failures via `console.error`. `fetch`
  and `execFile` are injectable for tests.
- [x] 1.2 `worker/lib/replies.ts`: `drainQueue` resolves the bearer per send
  via `getNightbotToken()` (injectable `tokenFn`); a 401 response triggers
  `forceNightbotRefresh()` (injectable `refreshFn`) and one retry with the
  new token; `enqueueNightbotSend` counts Nightbot as configured when either
  `NIGHTBOT_CHANNEL_SEND_TOKEN` or (`NIGHTBOT_REFRESH_TOKEN` +
  `NIGHTBOT_CLIENT_ID` + `NIGHTBOT_CLIENT_SECRET`) is set, keeping the
  single logged skip otherwise.
- [x] 1.3 `worker/index.ts`: `main()` primes `getNightbotToken()` once before
  the loop and logs days remaining (or the unconfigured skip).

## 2. Doppler state

- [x] 2.1 Set `NIGHTBOT_CLIENT_ID`, `NIGHTBOT_CLIENT_SECRET`, and
  `NIGHTBOT_TOKEN_EXPIRES_AT` (current token's expiry) in the `prd` config;
  verify read-back with `doppler secrets get … --plain`.

## 3. Verify

- [x] 3.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean.
- [x] 3.2 `tests/unit/nightbot-token.test.ts`: renew-ahead boundary (refreshes
  under 5 days, not over), refresh-token rotation stored, failure backoff
  (second failed attempt within the hour makes no fetch call), null when
  unconfigured — all via injected fetch/exec and env stubs.
- [x] 3.3 `tests/unit/bot-replies.test.ts`: 401 send → refresh called → retry
  sent with the new token; second 401 logs and drops (injected
  sender/token/refresh fns).
- [x] 3.4 `scripts/verify-nightbot-refresh.ts` (real remote systems): asserts
  the 5 Nightbot secrets exist; runs `forceNightbotRefresh()` for real;
  asserts the returned token differs from the starting one, authenticates as
  `@azanything` against `GET /1/me`, and matches `doppler secrets get
  NIGHTBOT_CHANNEL_SEND_TOKEN --plain` read-back (persistence proven).
- [x] 3.5 `npx openspec validate add-nightbot-token-refresh --strict`.
