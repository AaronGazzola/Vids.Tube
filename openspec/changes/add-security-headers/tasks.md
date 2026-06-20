## 1. Build the CSP from env

- [x] 1.1 In `next.config.ts`, add a helper that derives an origin (`scheme://host`) from a URL string and returns `""` for an empty/unset value, so missing env vars contribute no token
- [x] 1.2 Read `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VOD_BASE_URL`, `NEXT_PUBLIC_STREAM_HOST`; compute the Supabase `https` origin and its `wss` variant (same host)
- [x] 1.3 Assemble the CSP directive string: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:` + supabase + vod-base + `https://picsum.photos https://fastly.picsum.photos`; `media-src 'self' blob:` + stream-host + vod-base; `connect-src 'self'` + supabase-https + supabase-wss + stream-host + vod-base; `font-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'` (filter out empty tokens)

## 2. Wire the headers() block

- [x] 2.1 Add an async `headers()` to the `NextConfig` returning one entry for source `/:path*` with: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] 2.2 Add the CSP under `Content-Security-Policy-Report-Only`, gated by a `CSP_ENFORCE = false` constant that switches the header name to `Content-Security-Policy` when true (Report-Only for now)

## 3. Verification

- [x] 3.1 `npx tsc --noEmit` and `npx eslint next.config.ts` pass
- [ ] 3.2 Manually confirm (deferred — needs Doppler env; tracked as a Linear verification issue): with the app running, home/channel/VOD playback/live stream/chat/thumbnails all work and the browser console shows **no** CSP-Report-Only violations; then flip `CSP_ENFORCE` to true and re-verify the same flow before enforcing
