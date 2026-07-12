## 1. Schema

- [x] 1.1 `npx supabase migration new stream_lifecycle`; add `draft` to the
  `streams.status` domain (enum value or CHECK constraint), add
  `streams.live_at timestamptz null` and
  `streams.created_in_ui boolean not null default false`
- [x] 1.1a Add a `stream_gaps` table (`id`, `stream_id` FK cascade, `gap_start_at`,
  `gap_end_at` nullable) for reconnect gaps during a live broadcast; index by
  `(stream_id, gap_start_at)`; RLS publicly readable (VOD replay needs it)
- [x] 1.2 Add a partial unique index enforcing one active stream per channel:
  `unique (channel_id) where status in ('draft','scheduled','preview','live')`
- [x] 1.3 Verify/add `on delete cascade` from `chat_messages`, `stream_goals`,
  `chat_scoring_state`, viewer score/standing tables, and `banned_participants` to
  `streams(id)` so a discard delete removes all per-stream data
- [x] 1.4 `npx supabase db push`; regenerate types
  (`npx supabase gen types typescript … > supabase/types.ts`)

## 2. Lifecycle helpers (`lib/stream.ts`)

- [x] 2.1 Add a `isStreamPublic(row)` predicate:
  `(scheduled_start_at != null && status in ('scheduled','preview')) || status === 'live'`
- [x] 2.2 Rework `decideGoLive` to claim the single active pre-encoder row
  (`status in ('draft','scheduled')`) as `claim`; return `reconnect` for a fresh
  `preview`/`live`; return `new` (ad-hoc) when no active row exists; remove
  `new-after-stale`
- [x] 2.3 Add a `previewRevertTarget(row)` helper returning `'scheduled' | 'draft' | 'delete'`
  per the origin rule (dated → scheduled; `created_in_ui` → draft; else delete)

## 3. Ingest — connect (`app/api/ingest/live/route.ts`)

- [x] 3.1 Select the channel's single active row (any of draft/scheduled/preview/live)
  instead of the newest row + a separate scheduled query
- [x] 3.2 On `claim`: set `status='preview'`, `started_at`, `hls_path`,
  `last_seen_at`, preserving `scheduled_start_at`, `created_in_ui`, and settings
- [x] 3.3 On `new`: insert `status='preview'`, `created_in_ui=false`, `hls_path`,
  `started_at`, `last_seen_at`
- [x] 3.4 On `reconnect`: refresh `hls_path`/`last_seen_at`, and if the row is
  `live` with an open `stream_gaps` row (`gap_end_at IS NULL`), close it (set
  `gap_end_at=now`)

## 4. Ingest — disconnect (`app/api/ingest/offline/route.ts`, `lib/broadcast-end.ts`)

- [x] 4.1 Replace the blanket `endBroadcastSession` call with active-row lookup +
  branch
- [x] 4.2 `preview` → apply `previewRevertTarget`: revert to `scheduled`/`draft`
  clearing `hls_path`/`started_at`/`live_at`, or `delete` the row; never create a VOD
- [x] 4.3 `live` → do NOT end; leave `status='live'` and open a `stream_gaps` row
  (`gap_start_at=now`, `gap_end_at=null`) if none is open. No VOD here — ending +
  VOD happen only in the End action (§5.4)
- [x] 4.4 `draft`/`scheduled`/none → no-op; make the route idempotent for repeated
  not-ready fires (do not open a second open gap)

## 5. Go live / discard actions

- [x] 5.1 Update the go-live action to require `status='preview'` and set
  `status='live'`, `live_at=now()` (and capture the subs-goal baseline if not set)
- [x] 5.2 Add `discardBroadcastAction` (owner-only): `draft`/`scheduled` → delete;
  `preview` → reset in place to a blank ad-hoc preview
  (`scheduled_start_at`, settings, `created_in_ui` cleared; goals/scoring rows
  deleted; row kept `preview`)
- [x] 5.3 Add a create/update action producing `draft` (no datetime) or `scheduled`
  (datetime); it edits the existing active row when one exists (never creates a
  second)
- [x] 5.4 Rework `endStreamAction`: allow ending a `live` row only when the feed is
  stale (encoder disconnected); if fresh, return an expected error telling the owner
  to stop the encoder first. On end set `ended`/`ended_at`, close any open
  `stream_gaps` row, and finalize the VOD (trigger the VM concat finalize; see §7)

## 6. Public visibility

- [x] 6.1 Update `getUpcomingScheduledBroadcastAction` and any public channel query
  to treat `draft` (and ad-hoc `preview`) as private, and dated `scheduled`/`preview`
  as the upcoming/waiting broadcast, via `isStreamPublic`

## 7. Recording: go-live-only + reconnect concat (VM)

- [x] 7.1 Thread `live_at` to the recording finalize (`GET /api/ingest/recording`
  returns `liveAt`) and trim the MP4 to start at `live_at`
- [x] 7.2 Finalize on End, not on disconnect: the not-ready hook no longer finalizes;
  End triggers the VM finalize. Concatenate every recorded segment from `live_at`
  onward into one MP4 (jump cuts at reconnects, no black)
- [x] 7.3 Gate publication: the processing VOD row flips to ready only once the
  stream is `ended` (a mid-broadcast disconnect must not publish a partial VOD)
- [x] 7.4 Update `docs/runbooks/live-streaming-vm.md` and
  `scripts/vm/mtx-finalize-vod.sh` for finalize-on-end + multi-segment concat
  (VM deploy is owner-run)

## 8. Verification

- [x] 8.1 `npx tsc --noEmit`, `npx eslint`, `doppler run -- npm run build` pass
- [ ] 8.2 Script test (custom TS, remote db): create draft → claim via simulated
  connect → preview → go live sets `live_at` → offline while live ends + VODs;
  preview disconnect reverts to draft/scheduled or deletes ad-hoc; discard deletes
  never-live rows; the partial unique index rejects a second active row
