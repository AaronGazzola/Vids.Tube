## Why

`!me` should merge a viewer's vids.tube activity with their YouTube history. The
lightweight link (no OAuth, which stays deferred): the user types their YouTube
handle on the Account page, the system resolves it to a channel id via the
YouTube Data API, and ownership is verified by posting a short code in the
owner's YouTube live chat from that channel — proving control without any
Google sign-in.

## What Changes

- **`youtube_links`** table: one row per vids.tube user — claimed
  `youtube_channel_id` + `youtube_handle`, a generated `verify_code`, and
  `verified_at`. Users read their own row; all writes go through owner-checked
  server actions (service role), so `verified_at` cannot be self-set.
- **Account page card** ("YouTube account"): enter a handle → the server
  resolves it via `channels.list?forHandle` (API key) and stores the id +
  canonical handle with a fresh 6-character code, unverified. The card shows the
  resolved channel, the verification instructions with the code, a re-generate
  control, verified state once confirmed, and Unlink. Changing the handle resets
  verification.
- **Worker verification matcher**: while engaged, YouTube-origin chat messages
  whose trimmed text equals an outstanding verify code AND whose author channel
  id equals the claimed channel id mark that link verified. A code posted from a
  different channel does nothing.
- `lib/youtube.ts` gains `fetchChannelByHandle(handle)`.

## Capabilities

### New Capabilities

- `youtube-handle-link`: the user-level link storage, handle resolution, the
  account card flow, and chat-code verification.

## Non-goals / Related

- No Google/YouTube OAuth (deferred to Linear).
- `!me` consumption of the link is the next change.
- Verification requires a live/waiting stream with the worker engaged —
  inherent to the chat-code design.

## Impact

- Migration `youtube_links` + types regen.
- `lib/youtube.ts` (`fetchChannelByHandle`), `worker/lib/verify-links.ts` (new)
  wired into the scoring loop, `app/(app)/account/page.{tsx,actions.ts,hooks.tsx}`
  (new card), `scripts/verify-youtube-link.ts`, e2e for the card.
