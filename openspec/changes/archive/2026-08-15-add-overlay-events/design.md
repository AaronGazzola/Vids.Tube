## Context

`worker/lib/commands.ts` already does the hard part. It parses a command, looks it up in the channel's
registry, enforces the cooldown and the per-stream limit, records the execution in `command_events`, and
then either replies with a custom string or calls a handler from a hardcoded map.

That map is the thing D6 forbids for overlays: *"Routing is never hardcoded to a particular overlay."*

Two facts shape everything below. The overlay route is unauthenticated and reads through the service role
behind a layout token. And `command_events` already holds a durable record of every execution, written
before any handler runs.

## Goals / Non-Goals

**Goals:**

- A chatter's `!feed` reaches the game, and reaches the right game.
- The streamer keeps every control they have over their other commands.
- An overlay learns who acted without learning who they are.
- A second overlay needs no change to the worker.

**Non-Goals:**

- Replies to chat from an overlay. An overlay saying things in the streamer's chat is a trust question
  this change does not need to answer, and adding it later takes nothing away.
- Events other than chat commands. Follows, subscriptions and stream start are named in §4 and none has a
  consumer; the shape here takes them without change.
- A per-viewer rate limit of the overlay's own. The registry's cooldown and per-stream limit already
  apply, per command, per participant, and are the streamer's to set.

## Decisions

### The logged execution is the delivery

`command_events` already receives a row with status `executed` before any handler runs. The overlay route
polls for rows it has not seen, using its token, and forwards them to the frame.

**Alternative rejected — the worker broadcasts over realtime.** About a second faster, and it loses an
event outright when the browser source is between loads. The command pipeline is batched anyway, so the
saving is a fraction of the end-to-end delay, and a chatter's action going missing because OBS was
restarting is the kind of thing nobody ever debugs successfully.

**Alternative rejected — the browser subscribes to the table directly.** `command_events` is owner-only
by row level security and the overlay route is signed out, so a browser subscription would see nothing.

### An overlay declares its commands; installing registers them

`overlays.commands` holds `{ keyword, description, cooldown_s?, max_per_stream? }`. Installing the
overlay inserts those into the channel's `chat_commands` with `kind = 'overlay'` and `overlay_id` set.
Removing the overlay deletes them.

They are ordinary registry rows from that moment on. The streamer can disable one, change its cooldown,
or see it on their public commands page, exactly as with `!ask`. That is the point: an overlay's commands
are the streamer's commands, not a parallel system the streamer cannot see.

A keyword the channel already uses is skipped rather than overwritten, and the install reports it. An
overlay must not be able to take `!help` away from the channel that owns it.

### The worker gains a branch, not a handler

```
if (row.kind === "overlay") continue;
```

after the execution has been logged. Written explicitly rather than relying on the existing fall-through
(`builtin_key` is null, so the handler lookup finds nothing and continues), because the fall-through is
correct by accident and the next person to read it deserves to know the row is the delivery.

### The actor is opaque, and this is the first time it matters

The event carries `actor`, an HMAC over the overlay, the channel and the participant key, using the
overlay's own signing secret. The same machinery the token's subject uses.

Two overlays cannot tell they are talking to the same chatter, and one overlay cannot follow a chatter
between channels. Until now that property was reserved; this is the change that spends it, and it is much
easier to keep than to add back once overlays have been given a shared identifier.

The display name rides alongside, because an overlay that wants to say "Bob fed the dragon" needs one and
the chat is already showing it. A name is not an identifier: it is not stable, not unique, and nothing
should be keyed to it.

### Events are read with a cursor, and a cold start is not a backlog

The endpoint takes a timestamp and returns executions after it, newest last, capped. A frame that
connects for the first time is given the recent past only, not everything since the row was created,
because an overlay replaying an hour of feeding on load is worse than missing it.

The route holds the cursor in memory, so a reload starts from the moment of the reload. A durable
per-installation cursor would survive that; it would also mean a browser source restarting after an hour
delivers an hour of commands at once. Neither is obviously right, and the one that cannot flood the
overlay is the safer default.

## Risks / Trade-offs

- **A command executed while the browser source is reloading is lost** → the row survives and could be
  replayed if that ever proves worth it, and the cursor decision above is deliberately the one that
  cannot flood.
- **Polling adds a second or two to something already batched** → measured against the pipeline it rides,
  not against zero.
- **An overlay could declare a hundred commands and clutter the streamer's registry** → they are visible,
  individually disablable rows in a list the streamer already reads, which is a better failure than a
  hidden one.
- **A display name can be anything a chatter sets it to** → it is already on the streamer's own overlay
  through the highlight and TTS surfaces, so this is not a new exposure.

## Migration Plan

1. Push the migration: the third `kind`, `overlay_id`, and the declaration column. Nothing reads them.
2. Deploy. Installing an overlay begins registering commands; the dragon declares none yet, so nothing
   appears until eco3d names them.
