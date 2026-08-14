## Context

After `add-overlay-registry`, the frame address carries `install=<uuid>`. That id is a name and nothing
more: unsigned, unexpiring, and worth nothing to an overlay that wants to know whose channel it is
serving. `docs/game-architecture.md` decision 5 already fixes the shape — *"Vids.Tube signs a short-lived
token naming the channel and hands it to the frame. eco3d verifies it"* — so verification is offline and
an introspection round trip is out.

What the documents do not settle is how the verifying key reaches an overlay author, because with one
first-party overlay it never came up.

## Goals / Non-Goals

**Goals:**

- The frame receives a token it can verify, naming the overlay, the channel, the installation and a
  viewer.
- One overlay cannot verify or forge another overlay's tokens.
- Two overlays cannot recognise the same person, and one overlay cannot follow a person across channels.
- A frame open for hours stays valid without being reloaded, because reloading restarts the game.

**Non-Goals:**

- The message channel, lifecycle messages and live settings push. The exchange endpoint stands in for
  the page pushing fresh tokens until that exists.
- The pairing claim that binds a channel to an eco3d account. That is eco3d's half.
- Any permission or scope claim. Nothing consumes one, and the token grants nothing beyond identity.
- Public-key verification. Additive later, and it only matters once strangers write overlays.

## Decisions

### A signing secret per overlay, HS256

Each registry row carries its own secret. Vids.Tube signs that overlay's tokens with it, and the overlay
verifies offline with its own copy. An overlay holds a key that verifies its own tokens and no others.

This is Twitch's model for extensions, and it fits for the same reasons: no round trip on the hot path,
no new dependency, and a compromised overlay is contained to itself and revoked by rotating one row.

**Alternative rejected — one shared secret for all overlays.** Every overlay could then forge every other
overlay's tokens. Rejected outright.

**Alternative rejected — asymmetric signing with a published key set.** Strictly better once strangers
are involved, because no secret ever has to be handed to a developer. It costs key storage, rotation and
a key endpoint now, for a benefit that arrives with the review flow that is already deferred. Moving
later is additive: the header already carries the algorithm, so a second algorithm can be introduced
while existing overlays keep verifying as they do.

**Alternative rejected — an opaque token verified by asking the host.** Ruled out by the settled
decision that eco3d verifies the token, and it puts a network round trip in front of every frame load.

### The secret lives in its own table, not on the registry row

`overlays` is readable by anyone when published, which is what lets the install list and the overlay
route read it. A secret column on that row would be world-readable, and row level security cannot hide a
column.

`overlay_secrets` is a separate table, keyed by overlay id, with row level security enabled and **no
policies at all**, so only the service role reaches it. A table nobody can read is harder to get wrong
than a column somebody must remember to exclude from every `select`.

### The token is a JWT, with a small claim set

```
header   { "alg": "HS256", "typ": "JWT" }
payload  {
  "iss": "vids.tube",
  "aud": "<overlay id>",
  "sub": "<opaque viewer id>",
  "viewerKind": "source" | "viewer",
  "channel": "<channel id>",
  "install": "<installation id>",
  "iat": <seconds>, "exp": <seconds>, "jti": "<random>"
}
```

JWT because an overlay author verifies it with whatever library their language already has, and because
`aud` naturally carries "which overlay is this for" — which is also the lookup key for the secret.

Identifiers are the stable uuids, never the channel slug, because a slug can be renamed and the overlay
binds an account to whatever this names.

### `viewerKind` exists so a browser source is never mistaken for a person

An OBS browser source has no signed-in viewer. The subject is the source itself, and the token says so.

Without this claim an overlay would reasonably treat `sub` as a person and attribute actions to them, and
the first real viewer id would be indistinguishable from the machine in the streamer's front room. Only
`source` is minted today; `viewer` arrives with the interactive surface.

The opaque id is derived, never stored: an HMAC over the overlay id, the channel id and the subject,
keyed by that overlay's secret. Stable per channel per overlay, and unlinkable across either, which is
the property that cannot be added back after overlays have been given a shared identifier.

### Twelve hours, exchanged while live

Short relative to a permanent id, long enough to survive a browser source that has been hidden all
afternoon. A frame exchanges its live token for a fresh one at `/api/overlay/token`, so a session that
has been open for hours never reloads.

**This is a stand-in, and the design already knows what replaces it.** The platform document has the page
delivering the token and refreshing it before expiry over the message channel. Once that exists, the page
becomes the authority, and the lifetime drops to minutes. Shortening it then is a constant, not a
redesign. Twelve hours is defensible only while the token grants identity and nothing else; the moment it
authorises a mutation, the short lifetime has to arrive with it.

### Re-minting must not reload the frame

The overlay route refetches its installation every 15 seconds. A freshly minted token on every poll would
change the iframe `src` every 15 seconds, and every change reloads the frame and restarts the game.

The frame's address is therefore memoised on the installation's identity rather than on the token, so a
re-mint of the same installation leaves the address untouched. A different installation still swaps the
frame, which is the one case that should reload it.

### The exchange endpoint needs cross-origin headers, or nothing can reach it

The caller is a framed overlay, which is on another origin by definition. Without
`Access-Control-Allow-Origin` and an `OPTIONS` handler the browser refuses the request before it is sent,
and the endpoint is unreachable by the only thing that has any use for it.

The origin allowed is the same build-time one the framing policy names, so exactly what may be framed may
call it, and nothing else.

Found by writing the endpoint and then asking who would call it, which is a question worth asking before
the endpoint rather than after.

## Risks / Trade-offs

- **A developer's secret has to reach them, and rotating it breaks their tokens until they update** →
  contained to one overlay, and the asymmetric path above removes the problem entirely when review makes
  it worth the cost. For the only overlay today, the secret is delivered by the deployment's own
  configuration rather than by being handed over.
- **The exchange endpoint is public and unauthenticated beyond the token itself** → it accepts only a
  live token and returns an equivalent one, so there is no amplification and nothing readable that the
  caller did not already hold. It is not rate limited in this change; a limiter is tracked separately
  rather than left as an unchecked box here.
- **A twelve-hour token in a URL is visible to anyone the streamer shows their browser source to** → it
  names a channel and grants nothing else today, and the lifetime shortens when that stops being true.
- **eco3d ignores the token until its own change lands** → deliberate. The parameter is inert on that
  side, exactly as the installation id is today, so this change ships without a coordinated release.

## Migration Plan

1. Push the migration creating `overlay_secrets`. Nothing reads it yet.
2. Run the seed script, which now generates a secret for any registry row missing one.
3. Deploy. The frame address changes from `install` to `t` in the same deploy, and eco3d ignores both.

Rollback is a revert of the render change; the table can stay, unread.
