## Why

The framed address currently carries a raw installation id. That id names an installation and nothing
more: it is not signed, it carries no expiry, and an overlay that receives it has been told nothing it
can trust. The second foundation point in `docs/overlay-platform.md` §5 is that **the token names the
overlay, the channel and an opaque viewer**, and that shape has to be right before a second overlay
exists, because every overlay ever written will read it.

This is the last piece before an overlay can act on a streamer's behalf at all. `add-overlay-registry`
made an overlay a row a channel installs; this makes the frame able to prove which channel it is serving.

## What Changes

- Each registry row gets its own signing secret, generated when the row is created.
- The frame address carries a short-lived signed token in place of the raw installation id. The token
  names the overlay, the channel, the installation, an opaque viewer, and an expiry.
- The viewer id is opaque and derived per channel per overlay, so two overlays cannot recognise the same
  person and one overlay cannot follow a person between channels.
- An overlay verifies the token offline with its own secret. It can verify only tokens minted for it.
- A token still inside its lifetime can be exchanged for a fresh one at a public endpoint, so a frame
  that has been open for hours never has to be reloaded to stay valid.
- **BREAKING for the overlay side:** the `install` parameter is replaced by a token. eco3d must verify
  the token to learn its channel. Until it does, it can ignore the parameter exactly as it ignores the
  installation id today, and nothing on screen changes.

## Capabilities

### New Capabilities

- `overlay-tokens`: framed overlays are handed a short-lived signed token naming the overlay, the
  channel, the installation and an opaque per-channel viewer; overlays verify it offline with a secret
  that is theirs alone; a live token can be exchanged for a fresh one.

### Modified Capabilities

- `overlay-game-window`: the framed address carries a signed token rather than the installation id.

## Impact

- One column on `overlays`, written on insert and never readable by anyone but the service role.
- `lib/overlay-token.ts` for minting and verification, using Node's built-in crypto. No new dependency:
  the token is a JWT so any overlay author can verify it with the library of their choice.
- A public route to exchange a live token for a fresh one.
- `getInstalledOverlayAction` returns a token instead of an installation id, and `framedOverlayUrl`
  carries it.
- The eco3d side is a separate change in that repository: verifying the token, and the pairing claim that
  binds a channel to an account.
- No change to the Content-Security-Policy, the registry's shape, or any built-in overlay.
