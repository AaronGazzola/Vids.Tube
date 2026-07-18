## Context

Everything about a broadcast hangs off one `streams` row. Overlays and controls
resolve "the current stream" as the most-recent `streams` row for the channel
(`order created_at desc limit 1`). Relevant existing code:

- `lib/stream.ts` — `decideGoLive(existing, nowMs, scheduled)` returns
  `reconnect | claim-scheduled | new-after-stale | new`; `STALE_MS`,
  `SCHEDULED_CLAIM_GRACE_MS`, `isOngoingAndFresh`, `isClaimableScheduled`.
- `app/api/ingest/live/route.ts` — heartbeat every 30s; applies the decision,
  updates `hls_path`/`last_seen_at`, claims a `scheduled` row to `preview`, or
  inserts a new `preview` row.
- `app/api/ingest/offline/route.ts` → `lib/broadcast-end.ts`
  `endBroadcastSession` — sets `ended`, and only if `wasLive` inserts a
  `videos` row (`status='processing'`) for VOD finalize.
- VM (`docs/runbooks/live-streaming-vm.md`, `scripts/vm/mtx-finalize-vod.sh`):
  MediaMTX records the whole RTMP session (from connect) to fMP4; `runOnNotReady`
  finalizes → uploads to R2 → calls `/api/ingest/recording`.

## Goals / Non-Goals

- Goals: private draft; public-visibility rule; single active stream;
  create-then-claim; discard; disconnect-revert; record only the live portion.
- Non-goals: the `/live` UI (see `unify-live-stream-page`); waiting-room chat and
  worker-availability validation (`add-waiting-room-chat`); worker engagement
  changes (`run-worker-through-prelive`).

## Decisions

### State model

`status ∈ { draft, scheduled, preview, live, ended }`. Active = not `ended` (and
not deleted). Distinguishing columns:

- `scheduled_start_at timestamptz null` — dated ⇒ public waiting room; null ⇒ not
  timed.
- `created_in_ui boolean` — true when the row was created by the owner UI (a
  draft/scheduled), false when created by the encoder heartbeat (ad-hoc preview).
  This is the disconnect-revert discriminator.
- `live_at timestamptz null` — set once at go-live; the recording trim boundary.

Public-visibility predicate (single source of truth, reused by public queries):
`(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview')) OR status = 'live'`.

Origin on preview disconnect:
- `scheduled_start_at` set → `scheduled`
- else `created_in_ui = true` → `draft`
- else → delete (ad-hoc)

### `decideGoLive` extension

Add `draft` alongside `scheduled` as a claimable pre-encoder row. The claim query
should select the single active pre-encoder row for the channel
(`status IN ('draft','scheduled')`), not just `scheduled`. Decisions become:

- `reconnect` — existing `preview`/`live` fresh (unchanged).
- `claim` — a `draft` or `scheduled` active row exists → set `preview`,
  `started_at`, `hls_path`, `last_seen_at` (keep `scheduled_start_at`,
  `created_in_ui`, and configured settings).
- `new` — no active row → insert `preview` with `created_in_ui = false`.
- Drop `new-after-stale` in favour of `reconnect` grace + explicit disconnect
  handling; a stale `preview`/`live` is resolved by the offline hook, not by the
  next connect creating a duplicate.

Keep the single-active-stream invariant: the claim/new query and the UI create
path both assume ≤1 active row; a DB partial unique index
(`unique (channel_id) where status in ('draft','scheduled','preview','live')`)
enforces it.

### Discard

Server action `discardBroadcastAction` (owner-only), branching on the active row:

- `draft`/`scheduled` → `delete from streams where id = … and status in ('draft','scheduled')`.
- `preview` → reset in place: `scheduled_start_at = null`, `created_in_ui = false`,
  `title/description/thumbnail_path/youtube_video_id/youtube_channel_id = null`,
  delete its `stream_goals`/`chat_scoring_state`, keep `status = 'preview'`,
  `hls_path`, `last_seen_at`. The still-connected encoder keeps it alive as a blank
  private preview. (Confirmation dialog wording lives in `unify-live-stream-page`.)

Never-live delete relies on FK `on delete cascade` from `chat_messages`,
`stream_goals`, `chat_scoring_state`, viewer-score/standing tables, and
`banned_participants` (or an explicit cleanup, mirroring `scripts/dryrun-stream.ts`
which deletes the stream and its `banned_participants`).

### Disconnect handling

`/api/ingest/offline` no longer calls the blanket `endBroadcastSession`. Instead:

- Look up the channel's active row.
- `preview` → revert per the origin rule above; clear `hls_path`, `started_at`,
  `live_at`. No VOD.
- `live` → keep the reconnect grace (only act when `last_seen_at` is stale beyond
  `STALE_MS`); on a real end, set `ended`, `ended_at`, and (since `wasLive`) create
  the VOD row via the existing path.
- `draft`/`scheduled`/none → no-op.

MediaMTX fires `runOnNotReady` on every disconnect including brief blips, so the
route must be idempotent and rely on `last_seen_at` for the live grace.

### Record from go-live

Add `live_at` set at go-live. Two viable VM approaches (pick during infra work):

1. Trim in finalize — `mtx-finalize-vod.sh` receives/reads `live_at` and starts the
   MP4 at `live_at − recording_start_epoch`; simplest, no MediaMTX runtime control.
2. Toggle recording at go-live — start MediaMTX recording only when `status = live`;
   avoids capturing preview at all but needs runtime record control.

The app contract is only that `live_at` exists and the finalized VOD excludes
everything before it. The recording hook already binds by `recordedAt`/session; it
additionally must not publish preview seconds.

## Risks / Migration

- Backfill: existing active rows have `created_in_ui = false` (treated as ad-hoc);
  acceptable since there is one owner and no in-flight drafts.
- The partial unique index will fail if duplicate active rows already exist; verify
  none before applying.
- Deleting a stream must not orphan an in-progress `videos` row; only never-live
  rows (no `videos`) are deleted.
