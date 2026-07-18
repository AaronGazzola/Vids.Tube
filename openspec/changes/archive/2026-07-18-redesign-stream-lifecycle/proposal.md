## Why

The stream lifecycle today only supports `scheduled → preview → live → ended` on a
single `streams.status`, and several behaviours the new `/live` workflow needs are
missing or wrong:

- There is no private **draft** state. A broadcast configured in the UI before the
  encoder connects has nowhere to live, and every `scheduled` row is implicitly
  public.
- **Discard** does not exist. Once a `preview`/`scheduled` row exists there is no
  owner action to cancel it.
- **Encoder disconnect** always ends the stream (`endBroadcastSession` flips any
  `preview`/`live` row to `ended`). A brief OBS drop during setup should not destroy
  the broadcast.
- **Recording includes preview footage.** MediaMTX records from the moment OBS
  connects (`preview`), so the finalized VOD contains the private preview. The VOD
  row is only created `wasLive`, but the footage is wrong.
- There is no single-**active-stream** guarantee or a clean rule for what is public.

This change reshapes the lifecycle so the owner can create/configure a broadcast
before connecting, keep it private until go-live, discard it, survive encoder
drops, and record only the public (live) portion.

## What Changes

- **`draft` status**: created in the UI with no scheduled datetime; private (owner
  only); no encoder. A `scheduled` row is the same thing **with** a datetime and is
  public (waiting room). Visibility rule: a row is public when
  `scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview')`, or when
  `status = 'live'`. Everything else (`draft`, ad-hoc `preview`) is private.
- **One active stream**: at most one `streams` row per channel is "active"
  (`status IN ('draft','scheduled','preview','live')`). The `/live` page always
  targets it; creating/scheduling edits the existing active row rather than making a
  second.
- **Create-then-claim**: the UI creates the active stream (`draft` or `scheduled`);
  the encoder **claims** it on connect (→ `preview`). If the encoder connects with
  **no** active stream, it creates one directly in `preview`, flagged
  `created_in_ui = false` (ad-hoc).
- **Discard** (owner action, allowed in `draft`/`scheduled`/`preview`):
  - `draft`/`scheduled` (no encoder): delete the row → no active stream.
  - `preview` (encoder connected): reuse the row, strip the schedule + all
    per-stream settings back to defaults so it becomes a **blank private ad-hoc
    preview** (the still-connected encoder would otherwise immediately recreate one).
  - Never-live rows are **deleted** (cascading their chat/scores/bans). Only
    `live → ended` rows are retained (they own VODs).
- **Disconnect handling** (`/api/ingest/offline`):
  - `preview` with `scheduled_start_at` set → revert to `scheduled`.
  - `preview` created in the UI (draft origin) → revert to `draft`.
  - `preview` ad-hoc (`created_in_ui = false`) → delete.
  - `live` → **never ended by disconnect**; the row stays `live` and the disconnect
    opens a reconnect gap (in `stream_gaps`) that a reconnect closes. Only the
    owner's End action ends a live broadcast, and only when the encoder is
    disconnected. The VOD is finalized on End by concatenating all recorded segments
    since `live_at` (jump cuts at reconnects, no black).
  - On any preview revert, clear the feed fields (`hls_path`, `started_at`).
- **Record from go-live only**: add `streams.live_at` (set when the owner presses Go
  live). The VM finalize excludes everything before `live_at` (trim, or start the
  recording at go-live), so the VOD contains only the public portion.
- **Go live** requires `preview` and sets `status = 'live'` + `live_at = now()`,
  revealing the feed publicly; the subs-goal baseline is captured here if not already
  captured at schedule time.

## Capabilities

### New Capabilities

- `stream-lifecycle`: the canonical state machine (`draft`/`scheduled`/`preview`/
  `live`/`ended`), the single-active-stream rule, public-visibility rule,
  create-then-claim, discard, disconnect handling, and the `live_at` go-live marker.

### Modified Capabilities

- `stream-pipeline`: `/api/ingest/live` and `/api/ingest/offline` decision logic
  (`lib/stream.ts` `decideGoLive`) extended for `draft`, claim-from-draft, and
  disconnect-revert; `endBroadcastSession` no longer ends `preview`.
- `scheduled-broadcasts`: create/edit now yields `draft` (undated) or `scheduled`
  (dated); adds discard.
- `vod-recording`: recording/finalize excludes pre-`live_at` footage.

## Impact

- DB migration: add `draft` to the `streams.status` domain; add
  `streams.live_at timestamptz null` and `streams.created_in_ui boolean not null
  default false`. Confirm `chat_messages`, viewer scores, `banned_participants`,
  `stream_goals`, `chat_scoring_state` cascade-delete on `streams` delete (discard
  relies on it).
- `lib/stream.ts`, `app/api/ingest/live/route.ts`, `app/api/ingest/offline/route.ts`,
  `lib/broadcast-end.ts` change.
- VM: MediaMTX/finalize change so the recording starts at (or is trimmed to)
  `live_at`. Owner-run infra step; tracked with the VM runbook.
- Public channel queries must treat `draft` as private (see
  `getUpcomingScheduledBroadcastAction`).
- Depends on nothing; `unify-live-stream-page`, `add-waiting-room-chat`, and
  `run-worker-through-prelive` build on the states defined here.
