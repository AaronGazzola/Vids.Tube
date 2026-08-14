## Why

Unique chatters is a lifetime figure counting everyone who has ever spoken in the community. On
a banner during a broadcast that reads as a claim about tonight, and it barely moves, so it is
the one number on the strip that never rewards a look.

What is wanted is how many different people have spoken in the broadcast being watched.

## What Changes

- **BREAKING** The unique chatters metric is scoped to the current broadcast and renamed to say
  so. Off air it shows a dash, like every other per-broadcast figure. A saved message carrying
  the old lifetime kind degrades to no metric rather than silently changing meaning.
- The count is taken from the chat itself rather than from any aggregate, so it is true while
  the broadcast runs rather than only after the post-broadcast pass has rebuilt things.

## Capabilities

### New Capabilities

### Modified Capabilities
- `message-banner-metrics`: unique chatters becomes a per-broadcast figure.

## Impact

- A migration adding `stream_unique_chatters`, a read-only function counting distinct
  participants in one broadcast's chat, closed to signed-out visitors.
- `app/(app)/live/demo.types.ts`, `lib/banner-metrics.ts` and the counts action.
- No layout migration: the only kind any saved layout carries is members.
