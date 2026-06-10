## Why

User identity renders as a raw 8-character uuid slice (`userId.slice(0, 8)`) in
VOD comments, live chat, and chat replay. The channel scaffold (handle, name,
avatar) now exists and is already declared readable for identity resolution, so
these surfaces can — and should — show who actually said something instead of an
opaque id. (Linear AZ-24; the blocking AZ-23 channel scaffold is implemented.)

## What Changes

- VOD comments, live chat, and chat replay resolve each message/comment author's
  channel from `owner_user_id` and render the channel `@handle`, display name,
  and avatar instead of the raw uuid slice.
- Each author identity links to the author's channel page (`/@<handle>` /
  `[channelSlug]` route), consistent with existing channel-view presentation.
- Author identity is resolved in a batch (one channels read per message set), not
  per-row, to avoid N+1 reads; messages whose author has no resolvable channel
  fall back to a stable, non-uuid placeholder.
- `formatAuthor(userId) = userId.slice(0, 8)` and the equivalent inline slices in
  the live-chat and chat-replay components are removed.

## Capabilities

### New Capabilities
<!-- none — author identity resolution already exists as a channels requirement -->

### Modified Capabilities

- `vod-comments`: the public-read requirement changes — a comment's author is
  presented as the author's channel handle, name, and avatar (linked to the
  channel), not a raw/derived user id.
- `live-chat`: the public chat-read requirement changes — each chat message's
  author is presented as the author's channel handle, name, and avatar, not a
  raw/derived user id.
- `vod-chat-replay`: the time-synced replay requirement changes — each replayed
  message's author is presented as the author's channel handle, name, and avatar,
  not a raw/derived user id.

## Impact

- **Components**: `components/comments/comment-item.tsx`, `components/live-chat.tsx`,
  `components/chat-replay.tsx` (author rendering); likely a shared author-chip
  component reused from `components/channel-view.tsx` avatar/handle presentation.
- **Actions/queries**: comment and chat read actions (`app/watch/[videoId]/page.actions.ts`,
  `app/layout.actions.ts`) gain a batched channel lookup keyed by `owner_user_id`.
- **Types**: `ScoredComment`, `ChatMessage`, `ReplayMessage` carry resolved author
  identity (handle, name, avatar path) alongside `userId`.
- **Storage**: avatar URLs resolved via existing `channelAssetUrl` / `lib/storage`.
- **No DB/migration changes** — relies on the existing `channels` table and its
  identity-resolution read access.
