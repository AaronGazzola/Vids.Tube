## Why

This is the fourth and last foundation point in `docs/overlay-platform.md` §5: **events are delivered by
subscription rather than by hardcoded routing.** Until it exists, a chatter cannot affect an overlay at
all, which is the entire reason for the platform.

The command layer already parses `!keyword`, enforces cooldowns and per-stream limits, and logs every
execution. What it has no notion of is a command whose effect happens inside somebody else's overlay.

## What Changes

- A chat command may belong to an overlay. `chat_commands.kind` gains `overlay`, and the row names which
  one, so routing is a lookup rather than a branch anybody has to edit.
- An overlay **declares the commands it handles** on its registry row. Installing it creates those
  commands on the channel; removing it takes them away again.
- The streamer keeps full control: an overlay's commands are ordinary rows in their command registry,
  with the same enable switch, cooldown and per-stream limit as every other command, and the same guide
  page lists them.
- A framed overlay receives executed commands over the message channel built in the last change.
- Each event names its actor by an **opaque id, derived per channel per overlay**, plus the display name
  the chat already shows. This is the pseudonymous-viewer promise from D2 finally being kept rather than
  merely reserved.
- **BREAKING for the worker's constraint only:** the `kind` check now admits a third value. No existing
  row changes and no handler is touched.

## Capabilities

### New Capabilities

- `overlay-events`: an overlay declares the chat commands it handles, installing it registers them on the
  channel, and executions reach the framed overlay naming a pseudonymous actor.

### Modified Capabilities

- `overlay-message-channel`: the host additionally sends events a framed overlay has been sent for.
- `overlay-registry`: installing an overlay registers its declared commands; removing it withdraws them.

## Impact

- `chat_commands` gains `overlay_id` and a third `kind`; `overlays` gains a command declaration.
- `worker/lib/commands.ts` gains one explicit branch: an overlay command is logged and not replied to.
  The logged row is the delivery, so the worker needs no transport of its own.
- A token-authenticated endpoint the overlay route polls for events since a cursor.
- `public/overlay-sdk.js` gains `onEvent`.
- **Not in this change:** any reply to chat from an overlay, any event other than a chat command, and any
  per-viewer rate limit beyond the cooldown and per-stream limit the command registry already enforces.
