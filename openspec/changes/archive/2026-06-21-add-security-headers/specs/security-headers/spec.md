## ADDED Requirements

### Requirement: Baseline HTTP security headers on all routes

The system SHALL send the following HTTP response headers on all routes via the
Next.js `headers()` config:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

These headers SHALL NOT depend on environment variables and SHALL apply uniformly
to every response.

#### Scenario: Baseline headers present on a page response

- **WHEN** any app route is requested
- **THEN** the response includes `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and
  a `Permissions-Policy` disabling camera, microphone, and geolocation

#### Scenario: Site cannot be framed

- **WHEN** a third-party page attempts to embed an app route in an `<iframe>`
- **THEN** the browser blocks rendering due to `X-Frame-Options: DENY` and the CSP
  `frame-ancestors 'none'` directive

### Requirement: Content-Security-Policy scoped to the app's real origins

The system SHALL send a Content-Security-Policy whose host allowlists are assembled
at build time from `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VOD_BASE_URL`, and
`NEXT_PUBLIC_STREAM_HOST` (plus the image CDNs). The policy SHALL permit, and SHALL
NOT broaden beyond, the origins the app actually uses:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:` + Supabase + VOD base + image CDNs
- `media-src 'self' blob:` + stream host + VOD base
- `connect-src 'self'` + Supabase (https **and** wss) + stream host + VOD base
- `font-src 'self'`
- `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`

The Supabase origin SHALL be included in `connect-src` as both `https:` and `wss:`
so Realtime chat/presence works. The stream host and VOD base SHALL be included in
both `connect-src` and `media-src` so hls.js can fetch and play segments.

#### Scenario: Realtime, live video, and images all permitted

- **WHEN** the app loads channel-asset images, plays a VOD or live HLS stream via
  hls.js, and opens a Supabase Realtime chat connection
- **THEN** none of these are blocked by the CSP, because the Supabase (`https`+`wss`),
  VOD-base, and stream-host origins are present in the relevant `connect-src`,
  `media-src`, and `img-src` directives

#### Scenario: An unlisted origin is not permitted

- **WHEN** the page attempts to load a script or connect to an origin not in the
  allowlist
- **THEN** the CSP does not permit it (default-deny via `default-src 'self'`)

### Requirement: CSP ships Report-Only before enforcing

The system SHALL initially deliver the Content-Security-Policy via the
`Content-Security-Policy-Report-Only` header so that violations are reported by the
browser without blocking any resource. Promotion to the enforcing
`Content-Security-Policy` header SHALL occur only after the policy is verified
against the running app (no violations for normal flows: home, channel page, VOD
playback, live stream, chat, thumbnails).

#### Scenario: Report-Only does not break the app

- **WHEN** the app is served with the CSP in Report-Only mode and a user exercises
  home, channel, VOD playback, live stream, chat, and thumbnail loading
- **THEN** every feature works unchanged and any policy gaps are surfaced as browser
  violation reports rather than blocked resources
