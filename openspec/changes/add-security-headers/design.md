## Context

`next.config.ts` currently sets only `images.remotePatterns` and
`experimental.serverActions`. The app's external origins are all env-driven
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VOD_BASE_URL`, `NEXT_PUBLIC_STREAM_HOST`)
plus the picsum image CDNs. Live and VOD video play through hls.js
(`components/live-player.tsx`); chat/presence use Supabase Realtime over `wss`.

## Goals / Non-Goals

**Goals:**
- One `headers()` block in `next.config.ts` applying baseline headers + a CSP that
  exactly covers the app's real origins.
- Safe rollout: Report-Only first, enforce after verification.

**Non-Goals:**
- The VM-side CORS and firewall fixes (AZ-92, AZ-93).
- The future embeddable-player route and its framing override.
- Nonce-based CSP (kept as a later hardening step; `'unsafe-inline'` used for now).

## Decisions

- **Assemble CSP from env at build time.** `next.config.ts` reads the
  `NEXT_PUBLIC_*` hosts and builds the directive strings. Rationale: hosts differ
  per environment; hardcoding would break preview/prod. Derive the origin from each
  URL (scheme + host); for Supabase, add a `wss:` variant of the same host for
  Realtime. Guard against an empty env var (omit that token rather than emit a bare
  space) so a missing var can't widen the policy.
- **Report-Only first via a flag.** Emit the policy under
  `Content-Security-Policy-Report-Only`. A single constant (e.g. `CSP_ENFORCE`)
  flips the header name to `Content-Security-Policy` once verified, so the enforce
  step is a one-line change reviewed on its own.
- **`'unsafe-inline'` for script/style.** Next.js injects inline bootstrap scripts
  and Tailwind/Next inject inline styles; nonces are a larger change. Accept
  `'unsafe-inline'` now; a nonce-based tightening is a separate future change.
- **Frame protection is app-wide.** `X-Frame-Options: DENY` + `frame-ancestors
  'none'`. A future embed route will set its own relaxed headers via a more specific
  `headers()` source entry, overriding these — so denying globally now is
  forward-compatible.

## Risks / Trade-offs

- [A real origin omitted from the CSP breaks a feature (Realtime, hls.js, images)]
  → Report-Only first means violations are reported, not enforced; verify the full
  flow before enabling enforcement.
- [`'unsafe-inline'` weakens XSS protection vs nonces] → Accepted as a pragmatic
  baseline; tracked as a potential follow-up, still far stronger than no CSP.
- [Build-time env assembly could silently drop a host if an env var is unset] →
  Verification step exercises the live flows; empty-var guard avoids widening.

## Migration Plan

1. Ship this change with CSP in Report-Only.
2. Run the app (needs Doppler env), exercise home/channel/VOD/live/chat/thumbnails,
   confirm zero CSP violations in the browser console.
3. Flip `CSP_ENFORCE` to use `Content-Security-Policy`; re-run the same flow.
