## Why

`next.config.ts` sends no HTTP security headers, so the Vercel-served app relies on
permissive browser defaults: the site can be framed (clickjacking), there is no
Content-Security-Policy restricting where scripts/media/connections may come from,
and no MIME-sniffing, referrer, or permissions hardening. This is the in-repo
portion of AZ-91 (items 2 and 3 are VM/infra, tracked as AZ-92 and AZ-93).

## What Changes

- Add a `headers()` block to `next.config.ts` applying to all routes:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (no embedding)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - A **Content-Security-Policy** whose host allowlists are assembled at build time
    from `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VOD_BASE_URL`, and
    `NEXT_PUBLIC_STREAM_HOST`, plus the image CDNs (picsum).
- Ship CSP in **Report-Only** mode first (`Content-Security-Policy-Report-Only`) so
  violations are observable without breaking the app; flipping to enforcing
  `Content-Security-Policy` is a follow-up after real-app verification.
- **Forward-compat note**: framing is denied app-wide now; a future embeddable
  player (YouTube-style) will live on a dedicated route that overrides these
  headers to allow framing — this change must not preclude that.

## Capabilities

### New Capabilities

- `security-headers`: the HTTP security headers (incl. CSP) the app sends on all
  responses, the origin allowlists they encode, and the Report-Only → enforce
  rollout.

### Modified Capabilities

(none)

## Impact

- `next.config.ts` only — no runtime/app code, routes, or DB changes.
- CSP correctness depends on the env-driven origins above; an omitted origin would
  block a real feature (Supabase Realtime `wss`, hls.js media/segments, thumbnails),
  which Report-Only surfaces before enforcement.
- Out of scope / tracked elsewhere: AZ-92 (nginx CORS on the VM), AZ-93 (ufw/SSH on
  the VM), and the future embed-route framing override.
