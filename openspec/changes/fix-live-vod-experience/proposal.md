## Why

The live and VOD viewing experiences have three concrete defects. The standalone
`/live` page always renders a chat panel — even when nothing is streaming — and
the channel page (`/[channelSlug]`) shows no live presence at all, so a visitor
has no single place that reflects "is this channel live right now?". VODs derived
from live streams discard the chat that made them worth watching. And vertical
streams play back letterboxed inside a horizontal box because the watch page
cannot tell the video is portrait.

## What Changes

- **Channel page becomes the live home.** `/[channelSlug]` renders the live
  player + live chat when the channel's stream is `live`, and renders the normal
  channel page (banner, avatar, video grid) with a centered **static**
  offline/scheduled placeholder — and **no chat UI** — when it is not live. The
  root home `/` renders this same channel experience for the owner channel
  (no separate always-on chat surface), and the standalone `/live` page is folded
  into the channel page (`/live` redirects to it).
  - No scheduling data is introduced: the placeholder is static (no `scheduled_at`,
    no countdown, no Studio scheduling UI).
- **VOD chat replay.** `/watch/[videoId]` plays the source stream's chat messages
  synced to the video timeline, derived from `videos.source_stream_id` →
  `chat_messages`, offset against `streams.started_at`. The replay panel is shown
  by default and is dismissible; it is auto-hidden when the VOD has no
  `source_stream_id` or the source stream had no messages.
- **VOD orientation fix.** The watch page derives orientation at runtime from the
  `<video>` element's intrinsic `videoWidth`/`videoHeight` (on `loadedmetadata`),
  so portrait VODs render in a 9:16 container even when stored `width`/`height`
  are `null`. Stored dimensions remain a first-paint hint only.
- **Rotation-aware recording probe.** The VM finalize script
  (`scripts/vm/mtx-finalize-vod.sh`) probes display dimensions accounting for
  rotation metadata, so newly recorded VODs persist correct `width`/`height`.

## Capabilities

### New Capabilities
- `channel-live`: The channel page hosts the live experience — live player + chat
  when live, a static offline/scheduled placeholder with no chat UI when not live —
  superseding the standalone `/live` page.
- `vod-chat-replay`: Time-synced replay of a VOD's originating live-stream chat,
  shown alongside the player and dismissible.

### Modified Capabilities
- `vod-playback`: The format-aware player container determines orientation from the
  video's runtime intrinsic dimensions, falling back to stored `width`/`height`
  then 16:9 — so portrait VODs render correctly even when stored dims are `null`.
- `vod-recording`: The finalize dimension probe is rotation-aware, persisting the
  display orientation rather than the coded (pre-rotation) dimensions.
- `viewer-pages`: The root home `/` now renders the live channel experience inline
  (live player + chat when live, offline placeholder + no chat otherwise) instead
  of a banner that links to a separate live page, and the dedicated `/live` page
  is removed in favour of the channel page.

## Impact

- **App routes/components:** `app/[channelSlug]/page.tsx` (+ `page.hooks`,
  `page.actions`, `page.types`), `app/live/page.tsx` (removed/redirected),
  `app/watch/[videoId]/page.tsx` (+ hooks/actions/types), `components/live-view.tsx`,
  `components/live-chat.tsx`, `components/offline-card.tsx` (or a new
  scheduled/offline placeholder), new VOD chat-replay component.
- **Layout hooks:** `app/layout.hooks.tsx` (`useLiveStream`, `useLiveChat`) reused
  on the channel page.
- **VM pipeline:** `scripts/vm/mtx-finalize-vod.sh` dimension probe.
- **Data:** read-only use of existing `streams`, `chat_messages`, `videos`
  (`source_stream_id`); **no schema migration** and no new tables/columns.
- **Out of scope:** backfilling `width`/`height` for existing VODs (the runtime
  fallback covers them) and any real stream scheduling feature.
