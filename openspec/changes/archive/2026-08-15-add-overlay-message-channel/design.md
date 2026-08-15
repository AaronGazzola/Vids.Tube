## Context

The frame receives a token in its address and can read its settings once. Nothing reaches it after that.
The settings panel currently tells the streamer that a saved change arrives when the browser source
reloads, which is a true sentence about a product that should not need it.

`docs/overlay-platform.md` §4 lists what the host provides: identity, configuration pushed live,
subscribed events, and lifecycle. This change builds the pipe. Events ride it next.

## Goals / Non-Goals

**Goals:**

- A change the streamer saves reaches a running overlay without a reload.
- An overlay learns how much room it has, which is what the sizing work in §7 will need.
- An overlay author can implement the protocol without our SDK, so nothing is privileged.
- The conversation is safe in both directions: neither end talks to, or listens to, a stranger.

**Non-Goals:**

- Events. The pipe is built here; what flows through it is the next change.
- Frame-to-host requests. The frame announces itself and otherwise listens. Nothing an overlay could ask
  for today is unavailable to it over HTTP with its token.
- Token refresh over the channel. The exchange endpoint already does that, and two paths for one thing
  is a way to have neither work.
- Shown and hidden, per the proposal: an unrendered box has no frame to tell.

## Decisions

### Plain `postMessage` with origin checks, not a transferred `MessagePort`

A port handed over once is the tidier mechanism: after the handover the channel is private and no origin
filtering is needed. It loses anyway, because an overlay author who does not use our SDK must still be
able to implement the protocol from a description, and `postMessage` with an origin check is something
every web developer already knows and can inspect in a browser's own tooling.

Both directions are checked. The host posts only to the permitted origin, never `*`. The host accepts a
message only when `event.origin` is that origin **and** `event.source` is its own frame's window, because
origin alone would let any document on that origin talk to the page.

Upgrading to a port later is additive: the handshake would carry it, and an SDK that does not understand
one keeps working on the messages.

### The frame speaks first

The host cannot know when a frame's script is ready. The frame announces itself with `ready`, and the
host answers with everything it has.

The host also re-announces whenever what it holds changes, so a frame that missed the first answer
because it was slow to load is not stranded until the next edit.

**Alternative rejected — the host announces on a timer until acknowledged.** More moving parts to reach
the same place, and a frame that never answers would be re-sent to forever.

### Messages are versioned and namespaced from the first one

`{ channel: "vidstube-overlay", v: 1, type, ... }`. The namespace is checked before anything else,
because a page hosts other people's frames and the browser delivers everyone's messages to the same
listener. The version is present so that a second version can exist without guessing what an unversioned
message meant.

### The namespace key is `ns`, because `channel` already means something here

The first version used `channel` for the protocol's namespace and `channel` for the streamer's channel
id, in the same message. The namespace overwrote the id in every `hello`, so an overlay was told it was
serving a channel called `vidstube-overlay`.

Found by the end-to-end test asserting the frame received the right channel id, which is the only reason
the test asserted a value rather than a shape. On a platform where a channel is a streamer's channel,
nothing else may be called one.

### Settings ride on the installation the route already polls

The overlay route refetches its installation every 15 seconds. Settings are added to that payload rather
than given their own query or their own realtime subscription, so a change reaches the frame within one
poll with no new machinery.

Instant delivery is available and deliberately not taken: the layout broadcast channel already exists and
could carry an edit in about a second. Dragging a box needs that because the streamer is watching the
result move. Saving a setting does not, and a second subscription on the browser source is a cost with
no matching complaint.

### The size sent is the box's own, not the viewport's

The frame is told the width and height of the box it was given, in canvas units, alongside the scale
applied to it. A frame can measure its own viewport and needs no help doing so; what it cannot see is the
scale the streamer chose, which is the difference between a small tank and a distant one.

This is deliberately the shape the deferred sizing work in `docs/overlay-platform.md` §7 will need. It is
not that work: the box is still one fixed size, and this only reports it.

### The SDK is served, and equally free to be copied

`public/overlay-sdk.js` is a hand-written ES module with no build step, so anyone who has to trust it can
read it in one sitting. An overlay may load it from the host or vendor its own copy; the protocol is the
contract.

Loading it from the host is not required, deliberately. A required SDK is a privileged path, and D1 says
tiers separate review and distribution, never power.

## Risks / Trade-offs

- **A settings change takes up to fifteen seconds to appear** → matched to how often settings change, and
  the layout broadcast is sitting there if that ever stops being true.
- **A frame that never announces itself gets nothing, silently** → the host has no way to distinguish an
  overlay that has not loaded from one that does not speak the protocol, and both are the overlay's
  business. eco3d not speaking it yet is exactly this case, and it is fine.
- **`postMessage` is visible to any script running in either document** → true of the whole frame
  contract, which is why the token grants identity and nothing else.
- **The host trusts its own frame's window identity** → `event.source` comparison is only as good as the
  reference, which the host holds itself. This is the standard check.

## Migration Plan

Deploy. A frame that does not speak the protocol is unaffected, which today is all of them.
