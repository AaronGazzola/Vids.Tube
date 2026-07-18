## Why

Nightbot access tokens expire every 30 days. Today the worker reads a static
`NIGHTBOT_CHANNEL_SEND_TOKEN` from Doppler; when it expires, YouTube replies
silently degrade to logged skips until the owner manually redoes a browser
OAuth flow. The refresh token from the initial grant is already stored in
Doppler, so the worker can renew the token itself — no browser, no reminder,
no expiry babysitting.

## What Changes

- A **token manager** (`worker/lib/nightbot-token.ts`) that treats the token
  pair in Doppler as renewable state: it returns a valid access token on
  demand, refreshing it via Nightbot's `oauth2/token` endpoint
  (`grant_type=refresh_token`, using `NIGHTBOT_CLIENT_ID` +
  `NIGHTBOT_CLIENT_SECRET`) whenever the recorded expiry
  (`NIGHTBOT_TOKEN_EXPIRES_AT`) is within 5 days — and persists the new
  access/refresh/expiry triple back to Doppler via the CLI so the next worker
  run starts fresh.
- The **Nightbot send path** (`worker/lib/replies.ts`) resolves its bearer
  token through the manager instead of raw env, and treats a `401` send
  response as an expiry signal: force one refresh and retry the send once.
- The **worker startup** (`worker/index.ts`) primes the manager once so
  renew-ahead happens even on send-free days, logging days remaining.
- New Doppler secrets: `NIGHTBOT_CLIENT_ID`, `NIGHTBOT_CLIENT_SECRET`,
  `NIGHTBOT_TOKEN_EXPIRES_AT` (the app credentials the refresh grant needs,
  and the expiry bookkeeping).

Refresh failure is non-fatal everywhere: it logs, YouTube sends fall back to
the existing skip behavior, and vids.tube VidsBot replies are unaffected.

## Capabilities

- `bot-chat-replies` (modified): the Nightbot send queue gains token
  self-renewal.

## Out of scope

- Surfacing token health in the /live UI (worker-required warnings already
  exist; a dead refresh token still logs clearly).
- Any change to reply content, spacing, truncation, or ingestion exclusion.
