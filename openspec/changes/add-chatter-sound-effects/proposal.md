## Why

Every moment the overlay gives a chatter — a highlighted message, a spoken
message, a welcome card — is announced by the same two-note bell, so nobody in
chat can tell from audio alone whose moment it is. Letting a chatter bring their
own short sound turns each of those moments into something the chatter chose and
the audience learns to recognise, and it is something viewers can do themselves
and hear the result of on the same broadcast.

This promotes Linear AZ-205.

## What Changes

- Chatters upload a sound of their own, at most 3 seconds, from the account page.
  A chatter's upload does not play until the channel owner approves it.
- The channel owner uploads a sound on behalf of any member, from a sound button
  on the member rows the channel page and the live page already render. That
  button is visible only to the owner, and it is the only approval surface: one
  dialog uploads, plays what is currently set, approves a pending upload, and
  mutes.
- A member's own approved sound always outranks the owner's upload for that
  member. The owner can silence a member's sound but can never substitute a
  different one for it: a muted sound falls back to the default bell, never to
  the owner's upload.
- The resolved sound plays at the start of the member's overlay moments — the
  highlighted message, the spoken message, and the welcome card — in place of the
  fixed bell, with the spoken audio starting once the sound has finished.
- Sounds are held against the member's identity channel rather than a chat
  participant key, so linking a YouTube identity to a site account does not
  orphan an uploaded sound.
- Length is enforced three ways: the browser refuses an over-length file before
  upload, the storage bucket caps size and audio type, and playback is cut at 3
  seconds whatever was stored.

## Capabilities

### New Capabilities
- `chatter-sound-effects`: a member's personal overlay sound — who may upload
  one, how it is approved, how a member's sound and the owner's upload for that
  member are ranked, what muting does, and how length is bounded.

### Modified Capabilities
- `account`: the account page gains the member's own sound upload and its state.
- `channel-community-section`: community member rows gain an owner-only sound
  button opening the sound dialog.
- `streamer-control-room`: competition leaderboard rows gain the same button.
- `featured-overlay`: a highlighted message is announced by the member's resolved
  sound instead of the fixed bell.
- `tts-requests`: a spoken message is preceded by the member's resolved sound,
  and the spoken audio begins when the sound ends.
- `identity-merge`: merging two identities that each hold a sound resolves to one
  surviving sound rather than losing both.

## Impact

- New table holding one sound row per member per community, and a new storage
  bucket with a size cap and an audio type allowlist.
- New overlay sound player replacing the single synthesized bell, which stays as
  the default.
- The overlay fetches for highlights, spoken messages and ask exchanges each
  return a resolved sound alongside the identity they already resolve.
- The welcome card hook lands only once `add-overlay-welcome-card` merges; the
  rest of this change does not depend on it.
