## Context

Today the live experience lives at `/live` ([components/live-view.tsx](../../../components/live-view.tsx)),
which always renders a two-column grid with `LiveChat` on the right — even when
offline, where it degrades to a disabled "Chat is available during live streams"
input. The channel page ([app/[channelSlug]/page.tsx](../../../app/[channelSlug]/page.tsx))
shows only banner/avatar/video-grid and has no live presence.

VODs are produced by remuxing the live recording (`ffmpeg -c copy`, no re-encode,
[scripts/vm/mtx-finalize-vod.sh](../../../scripts/vm/mtx-finalize-vod.sh)), so R2
holds the exact orientation OBS sent. The watch page decides orientation from
stored `videos.width`/`height` ([app/watch/[videoId]/page.tsx:22](../../../app/watch/[videoId]/page.tsx)).
A DB inspection found **all current VODs have `width/height = null`**, so the page
falls back to a 16:9 box and portrait VODs are letterboxed.

The data needed for chat replay already exists: `videos.source_stream_id` →
`chat_messages` (`stream_id`, `body`, `user_id`, `created_at`), and
`streams.started_at` to anchor offsets. No schema change is required for any part
of this change.

## Goals / Non-Goals

**Goals:**
- The channel page is the single source of "is this channel live?" — live
  player + chat when live, static offline placeholder + no chat when not.
- VOD orientation is always correct, including for the existing `null`-dimension
  rows, without a backfill.
- VODs replay their originating chat in time with the video.
- Newly recorded VODs persist correct, rotation-aware dimensions.

**Non-Goals:**
- Any real scheduling feature (no `scheduled_at`, countdown, or Studio UI).
- Backfilling `width`/`height` on existing `videos` rows.
- Changing live chat read/post semantics (already covered by `live-chat`).
- ABR / vertical reformat / shorts (future milestones).

## Decisions

### 1. Channel page hosts live; `/live` folds in
Reuse the existing `useOwnerChannel`/`useLiveStream`/`useLiveChat` hooks from
[app/layout.hooks.tsx](../../../app/layout.hooks.tsx) on `/[channelSlug]`. Compute
`isLive = stream?.status === 'live' && !!stream.hls_path`. When live, render
`LiveStage` + `LiveChat` in the primary area; when not, render the existing
channel header/grid with a centered offline placeholder and **no** `LiveChat`.
- **Why:** one canonical URL per channel; removes the always-on chat surface.
- **`/live` handling:** redirect `/live` to the owner channel slug (server
  redirect) rather than maintaining a parallel page. Alternative — keep `/live`
  as a thin wrapper — rejected because it preserves the duplicate chat surface
  the proposal removes.
- **Chat gating:** the fix is structural (don't mount `LiveChat` when offline),
  not a disabled state inside the panel. This satisfies "no chat UI in the DOM".

### 2. Runtime orientation detection on the watch page
Determine orientation from the `<video>` element's intrinsic
`videoWidth`/`videoHeight` captured on `loadedmetadata`, held in component state.
Stored `videos.width`/`height` seed the container for first paint (avoiding layout
shift), then the runtime value wins.
- **Why:** intrinsic dimensions reflect the *decoded display* orientation
  (browsers apply rotation metadata), so this is correct even when stored dims are
  `null` or were probed pre-rotation. It needs no data migration.
- **Where:** the player already owns the `<video>` ref
  ([components/video-player/](../../../components/video-player/)). Surface an
  `onDimensions(w,h)` (or `onLoadedMetadata`) callback up to the watch page, which
  owns container sizing. Alternative — compute only from stored dims and rely on a
  VM backfill — rejected: leaves existing VODs broken until re-probed.

### 3. Rotation-aware probe in the finalize script
Replace the plain `ffprobe stream=width,height` with a probe that also reads
rotation (display-matrix `side_data_list` rotation, or the legacy `rotate` tag),
and swap width/height when rotation is ±90°. Keep the soft-fail behavior (omit
dims, never abort).
- **Why:** `ffprobe` width/height are *coded* dimensions; a phone/portrait source
  encoded as rotated landscape would otherwise report landscape. This makes
  *future* rows correct at the source; decision #2 makes *current* rows correct at
  render. The two are complementary, not redundant.

### 4. Chat replay: fetch-once, client-side time filtering
On the watch page, if `video.source_stream_id` is set, fetch the source stream's
`started_at` and all its `chat_messages` once (server action, ordered by
`created_at`). Precompute each message's `offsetMs = max(0, created_at - started_at)`.
The replay component subscribes to the player's `currentTime` (via `timeupdate`,
throttled) and renders messages with `offsetMs <= currentTimeMs`. Seeking is
handled naturally because it filters by absolute offset each tick.
- **Why one fetch:** a finished stream's chat is bounded and immutable; paging by
  time would add complexity for no benefit at MVP scale (<10 viewers, short
  streams). Alternative — realtime subscription — rejected: the stream has ended,
  nothing new arrives.
- **Visibility:** show by default when `messages.length > 0`; dismiss is local UI
  state. Hidden entirely when no `source_stream_id` or zero messages, so layout
  matches a no-replay VOD.
- **Read-only:** reuse `LiveChat`'s message-row rendering but with no composer; a
  dedicated `ChatReplay` component is cleaner than overloading `LiveChat` with a
  mode flag.

### 5. No new tables/columns/migration
All reads are against existing tables under existing RLS (chat read is already
public per `live-chat`). The watch-page replay action validates nothing beyond
the public read path.

## Risks / Trade-offs

- **Layout shift on first frame for `null`-dim portrait VODs** → seed from stored
  dims when present; for `null` dims accept a brief 16:9→9:16 correction on
  `loadedmetadata`. Acceptable and only affects legacy rows.
- **`timeupdate` granularity (~4Hz) makes replay feel slightly coarse** → fine for
  chat; if needed, drive a `requestAnimationFrame` ticker reading `currentTime`.
  Start with `timeupdate` to keep it simple.
- **Large chat history fetched at once** → bounded by stream length and tiny
  audience; if a future stream is huge, add range fetching then. Logged as a known
  limit, not solved now.
- **`/live` redirect must resolve the owner channel slug** → owner channel is the
  single tenant in v1; redirect target is derivable from `useOwnerChannel`/a server
  lookup. If multi-tenant later, `/live` semantics get revisited.
- **ffprobe rotation field varies by version** (`side_data_list` vs `tags.rotate`)
  → probe both and prefer whichever is present; default to no-swap when absent.

## Migration Plan

1. Ship app changes (channel page, watch page orientation + replay, `/live`
   redirect). No DB migration; deploy is a standard Vercel push.
2. Update the VM finalize script on the Hetzner box per the runbook; affects only
   VODs recorded after the update.
3. Rollback: revert the app deploy; the VM script change is independent and
   backward-compatible (still soft-fails to null dims).

## Open Questions

- Mobile layout: when live on a narrow viewport, does chat stack below the player
  (as `/live`'s grid collapses today)? Assumed yes — reuse the existing responsive
  grid. Confirm during implementation.
