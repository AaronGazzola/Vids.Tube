## MODIFIED Requirements

### Requirement: Content-Security-Policy scoped to the app's real origins

The system SHALL send a Content-Security-Policy whose host allowlists are assembled
at build time from `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VOD_BASE_URL`,
`NEXT_PUBLIC_STREAM_HOST`, and `NEXT_PUBLIC_GAME_EMBED_URL` (plus the image CDNs).
The policy SHALL permit, and SHALL NOT broaden beyond, the origins the app actually
uses:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:` + Supabase + VOD base + image CDNs
- `media-src 'self' blob:` + stream host + VOD base
- `connect-src 'self'` + Supabase (https **and** wss) + stream host + VOD base
- `font-src 'self'`
- `frame-src` + the game embed origin, or `'none'` where no game embed URL is set
- `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`

The Supabase origin SHALL be included in `connect-src` as both `https:` and `wss:`
so Realtime chat/presence works. The stream host and VOD base SHALL be included in
both `connect-src` and `media-src` so hls.js can fetch and play segments.

Only the origin of `NEXT_PUBLIC_GAME_EMBED_URL` SHALL enter `frame-src`; the path and
fragment of that value SHALL NOT. `frame-src` SHALL never be omitted, because an
omitted `frame-src` inherits `default-src 'self'` and silently blocks the game window
with no directive naming the cause.

#### Scenario: Realtime, live video, and images all permitted

- **WHEN** the app loads channel-asset images, plays a VOD or live HLS stream via
  hls.js, and opens a Supabase Realtime chat connection
- **THEN** none of these are blocked by the CSP, because the Supabase (`https`+`wss`),
  VOD-base, and stream-host origins are present in the relevant `connect-src`,
  `media-src`, and `img-src` directives

#### Scenario: The game window is permitted

- **GIVEN** `NEXT_PUBLIC_GAME_EMBED_URL` is set to a local production build of the game
- **WHEN** the overlay renders the game window
- **THEN** the frame loads, because that origin is named in `frame-src`

#### Scenario: No game configured means no frame permitted

- **GIVEN** `NEXT_PUBLIC_GAME_EMBED_URL` is unset
- **THEN** the policy sends `frame-src 'none'`

#### Scenario: An unlisted origin is not permitted

- **WHEN** the page attempts to load a script, frame a document, or connect to an
  origin not in the allowlist
- **THEN** the CSP does not permit it (default-deny via `default-src 'self'`)
