## Why

The go-live overlay stack (AZ-124) is built around simulcasting to YouTube and
Vids.Tube at once. Two upcoming pieces need to read the owner's YouTube broadcast:
the goal overlays need likes/subscribers/viewers (AZ-117), and the chat-scoring bot
needs the YouTube live chat (AZ-112). Both read the same broadcast and share the
same lookup, so this change builds that one YouTube read layer once, before either
consumer.

## What Changes

- **YouTube credential**: `YOUTUBE_API_KEY` in Doppler. Auth is settled — an API key
  alone covers everything here (metrics **and** `liveChatMessages.list` are read-only
  public data; **no OAuth**, no per-endpoint scopes; the Google project only needs
  YouTube Data API v3 enabled). Constraints carried forward: the broadcast must be
  **public**, and chat polling must honor the API's returned `pollingIntervalMillis`
  (each poll costs quota).
- **Broadcast mapping on `streams`**: add nullable `youtube_video_id` and
  `youtube_channel_id` columns so the owner can point a live Vids.Tube stream at its
  YouTube counterpart. One migration.
- **Shared read client `lib/youtube.ts`** (ported from `../Stream Overlays/lib/youtube.ts`):
  `parseVideoId`, `fetchVideoData` (likes, concurrent viewers, channelId,
  `activeLiveChatId`, broadcast state), `fetchSubs` (subscriber count), and
  `fetchLiveChatPage` (a page of normalized chat messages + `nextPageToken` +
  `pollingIntervalMillis`). Consumed by the app metrics path (AZ-117) and, via
  `@/lib/youtube`, by the worker.
- **Worker chat poller `worker/lib/youtube-chat.ts`**: wraps `fetchLiveChatPage` in a
  loop that respects `pollingIntervalMillis` and yields messages tagged
  `origin: 'youtube'`. The scoring job (AZ-112) will consume it; the scoring itself is
  **not** in this change.
- **Studio: set the YouTube video**: an owner action plus a minimal field on
  `/studio/overlay` to set/clear the live stream's YouTube video URL (writes the new
  `streams` columns via `parseVideoId`). The richer goals config (baseline/targets)
  stays in AZ-117.

- **Out of scope** (separate changes): the goal-overlay UI (AZ-117), the chat-scoring
  job (AZ-112), and anything requiring OAuth or write access.

## Capabilities

### New Capabilities

- `youtube-integration`: the read layer over the owner's YouTube broadcast — the
  credential, the stream→YouTube-video mapping, the shared metrics + live-chat read
  client, the worker chat poller, and the studio control to point a stream at its
  YouTube video.

### Modified Capabilities

(none — the new `streams` columns are additive and existing stream behavior is
unchanged.)

## Impact

- **DB**: one migration adding `youtube_video_id`/`youtube_channel_id` to `streams`
  (`npx supabase migration new`); `npm run db:types` regenerates `supabase/types.ts`.
  Push hits **production** Supabase — requires owner OK before `db push`.
- **Secrets**: `YOUTUBE_API_KEY` added to Doppler (`dev_personal`). The key was never
  committed (only a placeholder in the `Stream Overlays` README), so no rotation.
- **New files**: `lib/youtube.ts`; `worker/lib/youtube-chat.ts`; a studio overlay
  action + field; a `scripts/verify-youtube.ts` smoke check; new types in
  `app/layout.types.ts`.
- **Reuses**: the `streams` table + owner-guard pattern, `supabaseAdmin`, and the
  `../Stream Overlays` `lib/youtube.ts` logic (`parseVideoId`, the videos/channels
  fetches). The worker imports `@/lib/youtube`.
- No changes to existing chat, streams, ingest, overlay, or transcription behavior.
