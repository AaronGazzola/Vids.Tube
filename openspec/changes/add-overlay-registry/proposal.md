## Why

The one framed overlay that exists is addressed by a single build-time environment variable, so that
variable carries one streamer's whole game configuration and cannot serve a second streamer. Turning
Vids.Tube into an overlay platform starts by making an overlay a **row that a channel installs** rather
than a deployment constant, which is the first of the four foundation points in
`docs/overlay-platform.md` §5.

This is the smallest change that makes two channels able to run the same overlay independently. Token
minting, the frame message channel, the settings blob and event subscription follow as their own changes.

## What Changes

- A registry of framed overlays: each has an id, an owner, a name, a declared entry address and a status.
  The dragon game becomes row one and is not privileged.
- A per-channel installation: a channel installs an overlay, and the installation carries an opaque id of
  its own, so the framed address differs per channel.
- The Game surface stops reading the environment variable to decide what to frame. It frames the overlay
  installed on the channel being rendered, with the installation id carried in the query string.
- **BREAKING for the current deployment:** an overlay whose Game box is visible now renders nothing until
  an overlay is installed on that channel. The environment variable keeps exactly one job, which is
  naming the origin the Content-Security-Policy permits.
- The Overlays tab gains an install control listing the overlays available to the channel.
- Declared origin lists and declared permissions are **not** stored. Both belong to the registry
  eventually, neither is read by anything until the proxy and the permissions UI exist, and adding a
  column later is a migration rather than a rewrite.

## Capabilities

### New Capabilities

- `overlay-registry`: framed overlays exist as owned rows with a declared entry and a status; a channel
  installs an overlay and the installation is the per-channel identity of that overlay; an installation
  whose entry origin is not the permitted origin is refused.

### Modified Capabilities

- `overlay-game-window`: the framed address is no longer a single build-time value. It is derived from
  the overlay installed on the channel, while the framed **origin** remains build-time so that no address
  a viewer can write is ever framed.

## Impact

- Two new tables with row level security, plus a seed of the first overlay row.
- `components/overlay/game-window.tsx` takes the installation as a prop instead of reading the
  environment.
- `components/overlay/overlay-stage.tsx` passes the installation through, and every caller of the stage
  supplies it: the public overlay route, the popout route, the Overlays tab and the composer.
- `app/(app)/live/overlays-tab.tsx` gains the install control, with its action and hook.
- `next.config.ts` is unchanged. The Content-Security-Policy is unchanged.
- The eco3d.shop side is untouched by this change. Its `PlatformHost` still reads the link; replacing
  that with a verified token is the next change's work.
