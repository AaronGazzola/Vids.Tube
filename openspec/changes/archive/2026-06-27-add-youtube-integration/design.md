## Context

The overlay stack (AZ-124) simulcasts to YouTube and Vids.Tube. Goal overlays
(AZ-117) need YouTube likes/subs/viewers; the chat-scoring bot (AZ-112) needs the
YouTube live chat. Both read the same broadcast, and the live-chat id is returned by
the same `videos.list` call the metrics use, so a single read layer serves both. The
`../Stream Overlays` repo already implements the metrics reads against the YouTube
Data API v3 with an API key (`lib/youtube.ts`); this change ports that and adds the
chat read. There is currently no YouTube integration in Vids.Tube.

## Goals / Non-Goals

**Goals:**
- One shared, read-only YouTube client used by both the app (metrics) and the worker
  (chat), keyed off a stream→YouTube-video mapping the owner sets.
- Settle auth (API key only) and the quota/polling discipline once, here.

**Non-Goals:**
- The goal-overlay UI and its baseline/targets state (AZ-117).
- The chat-scoring job that consumes the chat poller (AZ-112).
- Any OAuth, write, or non-public-broadcast access.
- Caching/quota-budgeting beyond honoring the API's polling interval.

## Decisions

- **API key only — no OAuth.** Verified against the YouTube docs: `videos.list`,
  `channels.list`, and `liveChatMessages.list` all accept an API key for read-only
  public data; API keys carry no per-endpoint scopes. So the only credential is
  `YOUTUBE_API_KEY` (Doppler). Constraints that follow and are encoded as
  requirements: the broadcast must be **public**, and chat reads must honor the
  response's `pollingIntervalMillis`. *Alternative — OAuth:* only needed for private
  data or writes, neither of which applies; it would add a refresh-token dance for no
  benefit. *Note:* the key was never committed (gitignored `.env`; the repo README
  holds a placeholder), so no rotation is required.

- **Store the mapping as two columns on `streams`, not a new table.** A live stream
  maps to exactly one YouTube video, so `youtube_video_id` + `youtube_channel_id`
  nullable columns on `streams` are the minimal fit and read in the same row the rest
  of the stream logic already loads. *Alternative — a `youtube_broadcasts` table keyed
  by `stream_id`:* a 1:1 side table adds a join for no extra cardinality; revisit only
  if per-broadcast YouTube state grows. `youtube_channel_id` is cached alongside so the
  subscriber fetch doesn't re-derive it every poll (it comes from the first
  `fetchVideoData`).

- **One shared `lib/youtube.ts`; the polling loop lives in the worker.** The pure
  fetch functions (`parseVideoId`, `fetchVideoData`, `fetchSubs`, `fetchLiveChatPage`)
  live in `lib/youtube.ts`, ported from the `Stream Overlays` repo. The app metrics
  path (AZ-117) calls the video/channel fetches from an API route; the worker imports
  the same module via `@/lib/youtube` (already proven to resolve under `tsx`) and wraps
  `fetchLiveChatPage` in a stateful loop in `worker/lib/youtube-chat.ts`. *Rationale:*
  one definition of the API surface, no duplication; the only thing that differs is who
  drives the polling. The chat page fetch is stateless (takes a `pageToken`), so the
  loop state (token, interval) stays in the worker.

- **Shared `videos.list` lookup feeds both metrics and chat.** `fetchVideoData`
  returns `activeLiveChatId` alongside the metrics, so resolving "which chat to read"
  is the same call that powers the goal bars — no extra request, and the worker can get
  the `liveChatId` from the stream's `youtube_video_id` via that one call.

- **Quota discipline via the API's own signal.** `liveChatMessages.list` returns
  `pollingIntervalMillis`; the worker loop waits at least that long between pages.
  Metrics polling stays at the overlay's configurable interval (default 10s, min 3s,
  from AZ-117). This change does not add a global quota budget; honoring the interval is
  the contract.

- **Studio control is minimal here.** An owner action sets/clears
  `streams.youtube_video_id`/`youtube_channel_id` for the current live stream (using
  `parseVideoId`), surfaced as one input on `/studio/overlay`. The full goals config
  (paste-URL + baseline + targets) belongs to AZ-117; this change only needs the video
  mapping to exist and be settable.

- **Migration + types follow the repo norm.** `npx supabase migration new
  add_streams_youtube_mapping`; `db push` after owner OK (production); `npm run
  db:types`; add `TranscriptSegment`-style Row usage isn't needed, but expose the new
  columns through the existing `Stream` type (regenerated automatically).

## Risks / Trade-offs

- [Quota exhaustion from chat polling] → Honor `pollingIntervalMillis`; metrics use the
  configurable interval. A single broadcast at the default intervals stays well within
  the daily quota; heavier use is an AZ-117/AZ-112 concern, not this layer.
- [Broadcast not public → empty/forbidden reads] → Encoded as a requirement and surfaced
  in the smoke check; the owner must keep the simulcast public for reads to work.
- [`activeLiveChatId` absent until live] → `fetchVideoData` returns it only while the
  broadcast is live; the worker chat poller no-ops until it appears, the same way
  `concurrentViewers` is 0 off-air.
- [Migration hits production] → additive (two nullable columns on `streams`); gated on
  explicit owner OK before `db push`, verified by read-back.

## Migration Plan

1. `npx supabase migration new add_streams_youtube_mapping`; add the two nullable
   columns.
2. Owner OK, then `npx supabase db push` (production), then `npm run db:types`.
3. Add `YOUTUBE_API_KEY` to Doppler (`dev_personal`).
4. Build `lib/youtube.ts` + `worker/lib/youtube-chat.ts` + the studio action/field;
   verify with `scripts/verify-youtube.ts` against a public video (metrics) and a public
   live broadcast (chat).
5. Rollback: the columns are additive and unreferenced by existing flows; a follow-up
   migration dropping them fully reverts. No deployed runtime depends on the worker.

## Open Questions

- Exact normalized chat message shape (`author` display name vs channelId, super-chat
  metadata) — settle minimally now (`{ author, authorChannelId, text, publishedAt }`),
  extend when AZ-112 needs more.
- Whether metrics fetching should be memoized across overlay clients to save quota —
  deferred to AZ-117 where the polling route lives.
