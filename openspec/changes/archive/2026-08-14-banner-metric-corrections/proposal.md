## Why

Three faults in the banner metrics, all found by looking at the thing rather than at the spec.

An unresolved number renders as nothing at all, which takes the icon with it. That was argued
for on the grounds that a zero is a claim, and it is, but disappearing is worse: the line
reflows, the layout the streamer arranged jumps, and there is nothing to position against. The
absence needs to be visible rather than invisible.

The chat commands metric counts every command the channel has ever seen. What is wanted is how
many were used in the broadcast being watched, which is the number that moves while streaming
and the one worth putting on a banner.

There is no metric for how much was said. Chat volume is the most obvious number a streamer
would want beside a line about chat, and it is missing.

## What Changes

- **BREAKING** An unresolved metric renders a dash with its icon still in place, rather than
  rendering nothing. The layout no longer shifts when a number is unavailable.
- **BREAKING** The chat commands metric is scoped to the current broadcast rather than the
  channel's lifetime, and is renamed to say so. A saved message carrying the old lifetime kind
  degrades to no metric rather than silently changing meaning.
- A metric is added for the number of chat messages sent during the current broadcast.

## Capabilities

### New Capabilities

### Modified Capabilities
- `message-banner-metrics`: absence is drawn rather than hidden, the commands metric becomes
  per-broadcast, and a chat volume metric joins the list.

## Impact

- `app/(app)/live/demo.types.ts`: the kind list and its labels.
- `app/(overlay)/overlay/[channelSlug]/page.actions.ts`: commands counted for the live stream
  rather than the channel, and a new count of chat messages for it.
- `lib/banner-metrics.ts`: the two changed kinds.
- `components/overlay/message-banner.tsx`: the dash.
- No migration: the only kind any saved layout carries is members, which is unaffected.
