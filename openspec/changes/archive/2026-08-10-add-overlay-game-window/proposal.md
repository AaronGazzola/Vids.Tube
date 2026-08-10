# Game window on the stream overlay

## Why

The overlay carries six placeable surfaces today — the members strip, two goal bars, the competition
ladder, the shared highlight/TTS/ask slot and the break timer — all of them flat cards driven by stream
data. There is no surface that hosts a live application.

The Eco3D dragon is that application's first tenant. It is a WebGL simulation built on Three.js, Rapier
and MuJoCo living in the `eco3d.shop` repository, and it will grow into a game the audience plays. It is
shown by embedding its page in a frame, not by porting the simulation here, so that locomotion work stays
in one repository and the seam is built once.

**Nothing can be framed today.** The Content-Security-Policy declares no `frame-src`, so framed documents
fall back to `default-src 'self'` and every third-party frame is blocked outright. The window is dead on
arrival until the policy names the game's origin.

## What Changes

- Add a seventh placeable overlay surface, `Game`, positioned, scaled, faded, toggled and previewed by
  the existing layout editor exactly like the other six.
- Render that surface as a frame pointing at an address held in an environment value. The address is not
  read from the saved layout or from any other database row, so no value a user can write is ever framed.
- Name the game origin in a new `frame-src` directive, derived from that same environment value. Where
  the value is unset, `frame-src 'none'` is sent and the surface renders nothing.
- Default the new surface to hidden, so no existing channel's overlay changes appearance on deploy.

## Non-goals

- **No data flows either way.** Nothing about the stream reaches the game, and nothing from the game
  reaches the overlay. No messages are posted between the frame and the page.
- **No hosted game.** The address points at a local production build on the streaming machine
  (`http://localhost:3001`). Browsers exempt localhost from the insecure-content block, so a secure
  overlay page can still frame it. No public origin is introduced.
- **No layout version bump.** Saved layouts already fall back to the default for a surface they have never
  seen, so every hard-won position survives untouched.
- **No relaxation of any other directive**, and `frame-ancestors 'none'` still stands: this change lets
  the overlay frame one named origin, and does not let anyone frame the overlay.
- **No sound.** The frame is muted at the element, since a browser source feeding the stream must not
  emit audio nobody chose.

## Capabilities

### Added Capabilities

- `overlay-game-window`: a placeable overlay surface hosting an external application in a frame, with its
  address fixed in configuration rather than in data.

### Modified Capabilities

- `security-headers`: adds a `frame-src` directive naming the one origin the overlay is permitted to
  frame, assembled at build time from an environment value like the existing host allowlists.

## Impact

- One new surface key threaded through the overlay layout types, defaults, editor and overlay frame page.
  The key is a `Record` over the surface keys in four places, so the compiler names every site that needs
  the new entry.
- The security policy configuration gains one directive and one environment origin.
- No database migration and no change to any saved layout row.

## Deferred, not tasked

- Judging how the window reads composited over live video needs a running stream and the owner's eye, and
  is a Linear verification issue rather than a task box.
