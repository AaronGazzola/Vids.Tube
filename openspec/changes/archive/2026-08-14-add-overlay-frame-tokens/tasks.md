# Tasks

## 1. Where the secret lives

- [x] 1.1 `npx supabase migration new add_overlay_secrets`, creating `public.overlay_secrets` with
      `overlay_id uuid primary key references public.overlays (id) on delete cascade`, `secret text not
      null`, `created_at timestamptz not null default now()`.
- [x] 1.2 Same migration: `alter table public.overlay_secrets enable row level security` and define **no
      policies**, so nothing but the service role reaches it. Carry a comment saying that the absence of
      policies is the point.
- [x] 1.3 `npx supabase db push`, then regenerate `supabase/types.ts`. Applied 14-Aug-2026.
- [x] 1.4 Extend `scripts/check-overlay-registry-rls.ts`: assert that an anon client reading
      `overlay_secrets` returns no rows for a published overlay that has one, and that an insert is
      refused. Run it and record the output.

      Eight checks, all passing. The two new ones: a signing secret is invisible signed out even for a
      published overlay, and a signed-out insert into `overlay_secrets` is refused by the policy.

## 2. Minting and verifying

- [x] 2.1 `lib/overlay-token.ts`: `signOverlayToken(claims, secret)` and `verifyOverlayToken(token,
      secret)` producing and checking an HS256 JWT with `node:crypto` `createHmac`, base64url encoded,
      comparing signatures with `timingSafeEqual`. Verification rejects a wrong algorithm, a bad
      signature, a foreign issuer and an `exp` in the past, and returns null on a malformed token rather
      than throwing.
- [x] 2.2 Same file: `opaqueSubject(overlayId, channelId, subject, secret)` returning a base64url HMAC,
      so the id is derived rather than stored and differs per overlay and per channel.
- [x] 2.3 Same file: `mintInstallationToken(...)` assembling the claim set from design.md with
      `viewerKind: "source"`, `iss: "vids.tube"`, `aud` the overlay id and a twelve hour `exp`. Plus
      `refreshOverlayToken`, which reissues with a new `jti` rather than moving an old token's dates.
- [x] 2.4 `tests/unit/overlay-token.test.ts`: 13 cases. A round trip verifies; a payload edited after
      signing fails; a token signed with another overlay's secret fails; an `alg` of `none` fails; an
      expired token fails; a foreign issuer fails; four shapes of malformed input return null rather
      than throwing; the same subject yields different opaque ids across two overlays and across two
      channels, and does not carry the subject in the clear.

## 3. Handing the token to the frame

- [x] 3.1 `scripts/seed-dragon-overlay.ts`: generate a 32 byte random secret for any registry row that
      has none, leaving an existing secret untouched so re-running never invalidates live tokens. Run:
      `registry rows: 1, installations: 1, secrets: 1`.
- [x] 3.2 `lib/overlay-installation.ts`: `installationForChannel(channelId)` resolves the enabled
      installation, reads the overlay's secret through `supabaseAdmin`, mints, and returns
      `{ installId, entryUrl, token }`. An installation whose overlay has no secret returns null and
      logs, rather than framing an overlay that has been told nothing it can trust. Both the audience
      action and the owner action call it, so the two surfaces cannot disagree.
- [x] 3.3 `lib/overlay-frame.ts`: `framedOverlayUrl` takes the token and sets `t` instead of `install`.
      `tests/unit/overlay-frame.test.ts` updated for the renamed parameter, keeping the cases for an
      existing query, a surviving fragment, a foreign origin, a differing port and an unparseable
      address.
- [x] 3.4 `components/overlay/game-window.tsx`: pin the framed address to `installId` and `entryUrl` so
      a re-minted token for the same installation does not change `src` and restart the overlay.

      Held in state rather than in a memo or a ref. A ref read during render is what the React lint
      objects to, and a memo is a hint React may discard, which here would restart the game.
- [x] 3.5 `tests/unit/game-window-pinning.test.tsx`: mounts the component for real and re-renders. A new
      token for the same installation leaves `src` untouched; a different installation swaps it; the
      same installation moving to a new entry address swaps it.
- [x] 3.6 `app/(app)/live/overlay.actions.ts`: `getChannelInstallationAction` mints for the owner's
      surfaces, kept separate from the install list so a redraw of the panel does not mint a token.

## 4. Exchange

- [x] 4.1 `app/api/overlay/token/route.ts`: a `POST` accepting `{ token }`, reading `aud` from the
      payload without trusting it, loading that overlay's secret, verifying, and returning a freshly
      minted token for the same overlay, channel, installation and subject. Every failure returns the
      same status and body.

      Also carries cross-origin headers and an `OPTIONS` handler, allowing exactly the origin the
      framing policy names. Without them the browser refuses the request before sending it, and the
      endpoint would have been unreachable by the only thing that needs it.
- [x] 4.2 `tests/e2e/overlay-token-exchange.spec.ts`: five cases, all passing. A live token exchanges for
      one with a later expiry, the same claims and a different `jti`; an expired token is refused; a
      token signed with a different secret is refused; four kinds of refusal are byte-identical; the
      framed origin is allowed by the preflight.
- [x] 4.3 Rate limiting the exchange endpoint is **AZ-258**, not built here. The endpoint returns only
      what the caller already held, so there is nothing to amplify, and a limiter belongs with the
      others rather than alone.

## 5. Verify

- [x] 5.1 `npx tsc --noEmit` clean, `npx eslint` clean over every changed file, and 617 unit tests pass
      across 52 files. `npm run build:local` completes.
- [x] 5.2 `tests/e2e/game-window.spec.ts` passes in 36 s with the address carrying a token: the frame
      visible, its `src` matching a three-part JWT, a canvas reachable inside it, two screenshots 20 s
      apart differing, and no policy violation.
- [x] 5.3 The same run asserts the frame is not reloaded across a poll: `src` is compared before and
      after 26 seconds, which is longer than the installation query's 15 second refetch interval, and is
      unchanged.
