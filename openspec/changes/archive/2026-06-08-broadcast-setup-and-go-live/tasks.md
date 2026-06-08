## 1. Schema & types

- [x] 1.1 Create a migration (`npx supabase migration new add_stream_preview_and_metadata`) adding `description` (text, null) and `thumbnail_path` (text, null) to `streams`, and widening the status constraint to include `preview` (lifecycle `idle|preview|live|ended`)
- [x] 1.2 Add a migration for `videos.description` (text, null) so the VOD can inherit the broadcast description
- [x] 1.3 `npx supabase db push`, then regenerate `supabase/types.ts` (the derived `Stream`/`Video` types pick up the new columns automatically)

## 2. Per-session preview in the ingest hook

- [x] 2.1 In `lib/stream.ts`, extend `decideGoLive` so an "ongoing session" is a most-recent row whose `status` is `preview` OR `live` and is fresh (within `STALE_MS`); new sessions are created as `preview`; stale `preview`/`live` rows are ended (`new-after-stale`); reconnect preserves the existing `status`
- [x] 2.2 Update `app/api/ingest/live/route.ts` to insert/keep sessions as `status='preview'` (not `live`), per the updated `decideGoLive`
- [x] 2.3 Update unit tests `tests/unit/stream-session.test.ts` for the preview cases (new→preview, reconnect preserves preview/live, stale→new-after-stale)

## 3. Owner go-live / end actions

- [x] 3.1 Add `goLiveAction({ title, description })` (owner-auth; persists title/description, requires a non-empty title returning an `ActionResult` error otherwise, then flips the current `preview` stream to `live`; does NOT reset `started_at`). Owner writes use the admin client (streams has no RLS write policy) after an explicit ownership check.
- [x] 3.2 Add `endStreamAction` (owner-auth; current `live`/`preview` session → `ended`)
- [x] 3.3 Add `getCurrentBroadcastAction` (owner-auth; returns the owner channel's most-recent stream row so Studio can render idle/preview/live and self-preview)
- [x] 3.4 Add react-query hooks for the current broadcast, go-live, and end (unwrap `ActionResult`, toast on error per CLAUDE.md)

## 4. Custom thumbnail upload to R2

- [x] 4.1 Add a server action that uploads an image to the R2 VOD bucket via `@aws-sdk/client-s3` under a stream-scoped key and sets `streams.thumbnail_path` (owner-auth; validate content-type + size)
- [x] 4.2 Add a thumbnail picker in Studio (mirror `components/branding-upload-dialog.tsx`) wired to that action; render the current thumbnail via `vodUrl()`

## 5. VOD inheritance & thumbnail precedence

- [x] 5.1 `app/api/ingest/offline/route.ts`: copy `description` and `thumbnail_path` (in addition to `title`) from the stream to the processing `videos` row; create the `videos` row ONLY when the ending session had reached public `live` (preview-only → no VOD)
- [x] 5.2 `app/api/ingest/recording/route.ts`: set `thumbnail_path` from the auto-extracted key only when the row's `thumbnail_path` is null (custom thumbnail wins)

## 6. Public vs preview read paths

- [x] 6.1 Update `getLiveStreamAction` / `useLiveStream` so the public channel page treats only `live` as live (a `preview` stream reads as offline for viewers)
- [x] 6.2 Add an owner-scoped read for the Studio self-preview of a `preview` stream

## 7. Studio /studio/live UI

- [x] 7.1 Idle state: keep the RTMP URL + stream key (regenerate) as today
- [x] 7.2 Preview state: self-preview player + setup form (title required, description, thumbnail picker) + Go live button disabled until title is non-empty
- [x] 7.3 Live state: live indicator + End button (live viewer count is AZ-26)

## 8. Channel page live display

- [x] 8.1 Show the live broadcast's title + description near the live player (`components/channel-view.tsx` / `components/live-stage.tsx`)
- [x] 8.2 Ensure a `preview` stream is never rendered to viewers (offline state shown until `live`)
- [x] 8.3 Show the VOD's inherited description below the title on `/watch/[videoId]`

## 9. Tests & verification

- [x] 9.1 Extend `tests/e2e/live-vod.spec.ts` (owner-channel-aware, guarded by `ownerIsLive()`, with cleanup): a `preview` stream is not shown publicly; Go live is blocked without a title; after go-live the channel page shows the title; the resulting VOD inherits title + custom thumbnail
- [x] 9.2 `npx tsc --noEmit` and `npm run lint` clean
- [x] 9.3 Run unit + e2e suites (`PLAYWRIGHT_PORT=3100 doppler run -- npx playwright test`) and confirm green
- [x] 9.4 `openspec validate broadcast-setup-and-go-live --strict` passes
