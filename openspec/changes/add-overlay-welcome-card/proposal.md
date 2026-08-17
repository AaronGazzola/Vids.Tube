## Why

A first-time chatter becoming a member is the core moment of the product, and right now it is invisible
to everyone watching. The greeting is composed and sent to chat by `worker/lib/chatter-greeting.ts`, and
that is where it ends. Nothing about a new arrival reaches the broadcast.

Chatters arriving are the trigger, so the audience makes the demo happen rather than the streamer having
to stage one.

## What Changes

- A welcome card appears in the overlay when a chatter is greeted, drawn by the shared renderer so it
  appears on the OBS route and the Overlays tab alike.
- It occupies the existing shared feed slot, behind the highlight, the TTS card and the ask exchange. A
  dedicated box would cost canvas space on an already-crowded 1080x1920, and the slot already handles
  showing one thing at a time, the chime, and not repeating.
- The card is laid out avatar above, message below, rather than the highlight's avatar-beside-bubble.
  This is the arrival's own shape and reads at a glance as somebody appearing rather than as somebody
  being quoted.
- The greetings come from `stream_greetings`, which the worker already writes before it sends to chat.
  The worker is not changed at all.
- A new member and a returning member read differently, and a burst of arrivals greeted together shows as
  one card. The stored `kind` already records which of the three it is, so the overlay follows the rule
  the greeting step already applies rather than inventing a second one.
- The welcome gets its own visibility toggle, like the TTS card and the ask exchange have.

## Capabilities

### New Capabilities

- `overlay-welcome-card`: a chatter greeted in chat is shown on the broadcast as an avatar-above-message
  card in the shared feed slot, distinguishing a new member from a returning one and showing a burst as
  one card.

## Impact

- `components/overlay/welcome-card.tsx`, and a `top` pointer on `SpeechBubble`, which today draws only
  `left` and `right`.
- `app/(overlay)/overlay/[channelSlug]/page.actions.ts` and `page.hooks.tsx` gain a token-authenticated
  read of recent greetings for the live stream, joined to `channels` for the name and avatar.
- `app/(app)/live/demo.types.ts`: `welcome` joins `DemoOverlayKey`, defaulting to visible.
- **Not in this change:** any change to what the greeting says in chat, to who is greeted, or to the
  greeting queue; a sound distinct from the feed's existing chime; and the `!me` reply card, which is
  AZ-255 and a separate piece of work.
