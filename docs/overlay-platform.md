# The overlay platform

Written 14-Aug-2026, after the cross-project direction session. This document holds the **host side** of
the overlay-game platform: what Vids.Tube provides, and what it promises not to change.

The counterpart lives at `../eco3d.shop/docs/game-architecture.md`, which holds the tenant side and the
reasoning behind the shared decisions. The two are written to agree; where they disagree about the
contract, this file wins on what the host does and that file wins on what a game does.

Nothing here is an OpenSpec change. Each phase is promoted into its own small change when it is built.

---

## 1. Where things stand today

- **Three built-in overlays** ship as React inside the overlay stage: Highlights, Goals, Competition.
  Each is a first-party component drawn into a named box, laid out per channel through the composer, and
  served from a per-channel route.
- **One framed overlay** exists: the game window, an iframe whose address is a single build-time
  environment variable, with only that origin permitted in the framing policy.
- That single variable carries the whole configuration of one game for one streamer, so **it cannot
  serve two streamers**, and it is the thing this direction replaces.

## 2. The direction

Vids.Tube becomes a **general overlay-game platform**. Streamers browse a library of overlays, toggle
them, and configure them. Third-party overlays written by other people are an explicit long-term goal.
The dragon game from eco3d.shop is tenant one, and is not privileged.

**Two classes of overlay, and the distinction is permanent:**

- **Built-in overlays** are first-party React inside the stage. The existing three stay exactly as they
  are. Nothing in this direction rewrites them.
- **Framed overlays** are sandboxed iframes running somebody else's code. Stranger code can never be
  rendered directly inside the app, so the frame is architecture rather than a temporary inconvenience.

**The stage, the boxes, the layout composer and the per-channel routing already exist and are reused.**
A framed overlay is a new kind of occupant for a box, not a new stage.

## 3. Decisions locked

### D1 — One capability tier. Tiers separate review and distribution, never power. _14-Aug-2026._

Every framed overlay gets the same contract, the dragon game included. Capability granted later costs
nothing; capability withdrawn later breaks every installed overlay, so one tier is the reversible
choice. A first-party fast path would also become permanent, because the privileged route is always the
easier one to extend.

### D2 — Viewers are pseudonymous by default. _14-Aug-2026._

A framed overlay receives an opaque viewer id, stable per overlay per channel, and a display name for
the on-screen moment. The real account identity is released only after that viewer consents.

A chatter never agreed to hand their identity to a game developer, and default-deny stops every overlay
quietly profiling viewers across channels. Retrofitting this means taking identity away from overlays
that already have it, which is the one direction that breaks installations.

### D3 — Overlays are self-hosted, and reached through a fixed platform origin. _14-Aug-2026._

Modelled on Discord Activities rather than Twitch Extensions: the developer keeps hosting the overlay,
and Vids.Tube proxies the entry document through a per-overlay subdomain, with the external origins the
overlay needs declared up front.

Twitch requires uploads because Twitch distrusts thousands of unknown developers and employs a review
team; neither applies here. The upload model would also force a tenant's animation code through this
app's dev server, where frame rate collapses. What gets reviewed here is the **declared origin list**,
not an uploaded bundle.

### D4 — The host never becomes an identity provider for a tenant. _14-Aug-2026._

Vids.Tube states which channel is running the overlay. It does not create or own accounts on a tenant's
service. Binding a channel to a tenant account is the tenant's business, done once by the streamer.

### D5 — Settings are an opaque blob owned by the overlay. _14-Aug-2026._

Per channel, per overlay. Vids.Tube stores and edits them and never interprets them.

Modelling one game's settings as columns in this database would force a migration for the second game,
and would make the host responsible for validating things it cannot understand.

### D6 — Events reach overlays by subscription. _14-Aug-2026._

An overlay declares which events it wants. Routing is never hardcoded to a particular overlay. The
existing command registry is the source of chat commands.

---

## 4. The contract, version zero

What the host provides:

- **Identity.** A short-lived signed token naming the overlay, the channel, and an opaque per-channel
  viewer id, delivered to the frame on load and refreshed before expiry.
- **Configuration.** The settings blob for this channel and this overlay, readable on load and pushed
  live when the streamer edits it.
- **Events.** Subscribed stream events pushed into the frame: chat commands first, then follows,
  subscriptions, and stream start and end.
- **Lifecycle.** Shown, hidden, resized.

What the host does not provide, by design:

- Its session, its cookies, or its database.
- Its components or its design system.
- Chat history or the raw chat firehose. Only subscribed events arrive.
- The ability to act as the streamer against its own API.

Everything is rate limited.

**Permissions are declared, not assumed.** Audio is the first example: an overlay is a browser source
feeding the live broadcast, so sound is off unless the overlay declares it and the streamer approves it.

## 5. Foundation now, and what is deferred

**Must be right now, or the multi-game future is blocked:**

- Overlays are identified by an id from day one, with a registry row existing even for a single overlay.
- The token names the overlay, the channel and an opaque viewer, even though only one overlay exists.
- Settings are stored per channel per overlay as an opaque blob.
- Events are delivered by subscription rather than by hardcoded routing.

**Safe to defer, because adding it later is work rather than a rewrite:**

- The wildcard subdomain and the proxy. The framed origin can stay a single build-time entry for now,
  since an overlay cannot tell whether it is being proxied. This holds **only** while the four points
  above are honoured.
- The review flow, the permissions UI, the public catalogue, and developer documentation.

**No forward implementation.** None of the deferred work is built ahead of need. The rule is only that
today's choices must not foreclose it.

## 6. Foundational work

- An overlay registry: id, owner, declared origins, declared permissions, status.
- Token minting: short-lived, signed, naming overlay, channel and opaque viewer.
- Settings storage per channel per overlay, plus the streamer-facing editor.
- The two-way message channel between the page and the frame, and the small SDK the frame loads.
- Event routing by subscription, wiring the existing command registry to whichever overlay subscribed.
- Replacing the single build-time overlay address with a per-channel frame carrying a token.

## 7. Planned, and what today's work must not block

Recorded 14-Aug-2026. None of this is built, and none of it is scheduled. It is written down so that
choices made now stay additive rather than becoming a wall.

### Many framed overlays on one channel

A channel should eventually run several games at once, each in its own box. The registry, the token, the
settings blob and the event subscriptions are all keyed per overlay already, so none of them stands in
the way.

**What stands in the way today:** the overlay layout carries a fixed set of named boxes, one of which is
`game`, and the installed overlay is looked up with a limit of one. Boxes have to become a list keyed by
installation rather than a fixed set of names. That is layout work, additive, and it touches no part of
the contract.

### A box that resizes to any shape

The game box is `480 × 320` at scale 1, and the saved layout scales it uniformly, so its aspect ratio is
fixed. A framed overlay should instead be stretchable to any width and height the streamer drags.

**What stands in the way today:** the box model stores a scale, not a size. It has to store width and
height per box. Every other surface is a card that would keep using its nominal size, so this is an
addition to the box model rather than a change to the surfaces.

### An overlay declares how it wants to be sized

Not every game can be any shape. An overlay declares its sizing behaviour, and the host honours it:

- **`any`** — the overlay is given the box exactly as drawn and deals with it. The dragon game is this.
- **A locked ratio** — the overlay is drawn as large as fits inside the box at its own ratio, centred,
  with the remainder left transparent. The streamer still drags any box they like; the host does the
  letterboxing so every overlay author does not have to.

This is one column on the registry row, added when it is needed. Storing it now would be a column nothing
reads.

### The overlay learns its own size

An overlay that uses its box as a play area needs to know how big that box is. It already can: the frame
is a document and can measure its own viewport. The lifecycle `resized` message exists so an overlay can
react without polling, not because measuring is impossible.

**What must stay true:** the host never tells an overlay what its content should be, only how much room
it has.

### Sizing lives in settings, not in the contract

How large a creature is relative to its box, and how deep the enclosure runs, are the overlay's own
settings, stored in the blob the host does not interpret. This is exactly why the blob is opaque: the
host must never grow a `creature_scale` column, or game two arrives and the column is meaningless.

## 8. Not decided yet

- Whether built-in overlays are eventually migrated onto the same contract, or stay a separate class
  forever.
- How an overlay is submitted, reviewed and listed once strangers are involved.
- Whether a viewer's consent to identify is per overlay, per channel, or global.
- How a common currency across several games would work, which is a platform feature and never an
  overlay feature.
