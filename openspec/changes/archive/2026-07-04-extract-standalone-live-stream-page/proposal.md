## Why

The live experience is glued to the channel page: `components/channel-view.tsx` renders the `LiveStage` player + title/description + `LiveChat` inline when live, and falls back to the `ScheduledCard` countdown otherwise. To make the app behave like YouTube (a stream is something you click into; the channel page is a grid of cards), the watch experience needs to live on its own page. This promotes Linear issue AZ-65 and is the single-channel foundation for the YouTube-style channel page + smart home routing (AZ-67).

## What Changes

- Add a standalone live-stream page at `/[channelSlug]/live` that owns the watch experience for the channel's current/next stream in three states:
  - **scheduled** — coming-soon countdown (reuses `ComingSoonCard`).
  - **preview** — connected-but-not-live; reuses the same coming-soon countdown (no new preview-player infra in this change).
  - **live** — `LiveStage` player + stream title/description + `LiveChat`.
- Render pre-stream chat: `LiveChat` is present in the scheduled/preview states too, not just live (YouTube-style pre-stream chat). No DB/RLS change is required — the `chat_messages` insert policy only checks `user_id = auth.uid()`, not stream status, so posting against a scheduled/preview stream row already works.
- **BREAKING (viewer-facing):** Remove the inline live player / countdown section from `components/channel-view.tsx` entirely. The channel page becomes channel header + video grid only; the live experience no longer appears on `/[channelSlug]`.
- When there is no scheduled, preview, or live stream, `/[channelSlug]/live` redirects to `/[channelSlug]`.

## Capabilities

### New Capabilities
- `live-stream-page`: the standalone `/[channelSlug]/live` route and its `LiveStreamView` — scheduled/preview/live state selection, pre-stream chat, and the no-stream redirect.

### Modified Capabilities
- `channel-live`: the channel page no longer hosts the live experience. The requirements that mandate the live player/countdown/chat render on `/[channelSlug]` are removed; the live experience moves to the new `live-stream-page` capability, and pre-stream chat is no longer gated to `live`.

## Impact

- New: `app/[channelSlug]/live/page.tsx`, `components/live-stream-view.tsx`.
- `components/channel-view.tsx` — remove the `isLive ? LiveStage+chat : ScheduledCard` section and its now-unused imports/data hooks (`useLiveStream`, `useUpcomingScheduled`, `LiveStage`, `LiveChat`, `ScheduledCard`, `CollapsibleDescription`).
- Reuses existing pieces unchanged: `LiveStage`, `LiveChat`, `ScheduledCard`/`ComingSoonCard`, `getUpcomingScheduledBroadcastAction`/`useUpcomingScheduled`, `getLiveStreamAction`/`useLiveStream`.
- No database, migration, or RLS changes.
- Out of scope: the channel-page tab redesign and home routing (AZ-67), the VOD watch page. The existing root `/live` redirect (`app/live/page.tsx` → owner channel) is unrelated and unchanged.
