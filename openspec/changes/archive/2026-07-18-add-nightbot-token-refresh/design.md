## Token manager

`worker/lib/nightbot-token.ts` owns all token state:

- **Env inputs** (all via Doppler): `NIGHTBOT_CHANNEL_SEND_TOKEN`,
  `NIGHTBOT_REFRESH_TOKEN`, `NIGHTBOT_CLIENT_ID`, `NIGHTBOT_CLIENT_SECRET`,
  `NIGHTBOT_TOKEN_EXPIRES_AT` (ISO timestamp).
- **In-memory cache** seeded from env on first use; refreshed values replace
  the cache and `process.env` immediately so the running process never waits
  on Doppler.
- `getNightbotToken()` — returns the cached token, first refreshing when the
  expiry is unknown or less than **5 days** away (`RENEW_AHEAD_MS`). Returns
  `null` when Nightbot is entirely unconfigured (no token and no refresh
  materials).
- `forceNightbotRefresh()` — unconditional refresh, used by the 401 send path.
  Both refresh paths share a **1-hour failure backoff** so a dead refresh
  token logs once an hour instead of on every send.
- **Refresh call**: `POST https://api.nightbot.tv/oauth2/token` form-encoded
  `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`.
  Nightbot rotates the refresh token on every grant, so the response's new
  refresh token must always replace the stored one.
- **Persistence**: `doppler secrets set NIGHTBOT_CHANNEL_SEND_TOKEN=…
  NIGHTBOT_REFRESH_TOKEN=… NIGHTBOT_TOKEN_EXPIRES_AT=… --silent` via
  `execFile` with `cwd` = repo root (the directory Doppler is scoped to).
  A persistence failure is logged but the in-memory pair keeps the current
  process working; the next process run would then refresh again from the
  stale-but-valid stored refresh token only if it hasn't been rotated —
  which is why persist failures are logged loudly (`console.error`).
- Fetch and exec are injectable parameters (defaulting to global `fetch` /
  `child_process.execFile`) so unit tests run without network or Doppler.

## Send path

`drainQueue` in `worker/lib/replies.ts` resolves the bearer token per send via
`getNightbotToken()`. A `401` response triggers `forceNightbotRefresh()` and a
single immediate retry with the new token (mirroring the existing single 429
retry). `enqueueNightbotSend` treats "configured" as *either* a token or
refresh materials being present, so a worker started with only a refresh token
still self-heals.

## Startup prime

`worker/index.ts` `main()` calls `getNightbotToken()` once before the loop and
logs either the days remaining or the unconfigured skip — so renew-ahead
happens even when no YouTube command is ever typed.
