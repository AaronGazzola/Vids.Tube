## 1. Schema & types

- [x] 1.1 Create a migration (`npx supabase migration new add_scheduled_broadcasts`) adding `scheduled_start_at timestamptz null` to `streams` and extending the `status` constraint to include `scheduled`
- [x] 1.2 Push the migration (`npx supabase db push`) and regen `supabase/types.ts`

## 2. Ingest claim-scheduled

- [x] 2.1 Add `SCHEDULED_CLAIM_GRACE_MS` (default ~6h) to `lib/stream.ts` and a `claim-scheduled` branch to `decideGoLive`: it takes the candidate claimable scheduled row as an explicit input; precedence is reconnect (ongoing-and-fresh) > claim-scheduled > new/new-after-stale; return `{ action: "claim-scheduled", streamId }`
- [x] 2.2 In `app/api/ingest/live/route.ts`, query the nearest claimable scheduled row (status `scheduled`, `scheduled_start_at >= now - grace`, soonest start) alongside the most-recent row, pass both to `decideGoLive`, and on `claim-scheduled` update that row to `status` `preview` with fresh `hls_path`, `started_at`, `last_seen_at`, preserving title/description/thumbnail_path
- [x] 2.3 Unit tests for `decideGoLive`: claims nearest upcoming, reconnect wins over claim, missed (past grace) is not claimed, existing branches unchanged

## 3. Scheduled-broadcast actions & hooks

- [x] 3.1 Add `app/studio/broadcasts/page.actions.ts`: `listBroadcastsAction` (split into upcoming claimable `scheduled` ordered by start time, missed `scheduled` past the grace window, and past `ended`), `createScheduledBroadcastAction` (title required → insert `scheduled` row), `updateScheduledBroadcastAction` (title required, only while `scheduled`), `cancelScheduledBroadcastAction` (set `scheduled` row to `ended`; also used to delete a missed broadcast)
- [x] 3.2 Reuse the R2 thumbnail upload helper from `app/studio/live/page.actions.ts` for scheduled-broadcast thumbnails (target the scheduled row)
- [x] 3.3 Add `getUpcomingScheduledBroadcastAction` returning the channel's nearest claimable (not-missed) `scheduled` row for the channel page
- [x] 3.4 Add `app/studio/broadcasts/page.hooks.tsx` (react-query queries + mutations, unwrapping `ActionResult`) and a `useUpcomingScheduled` hook for the channel page

## 4. Studio Broadcasts UI

- [x] 4.1 Add `app/studio/broadcasts/page.tsx`: owner-gated page listing upcoming, missed, and past broadcasts
- [x] 4.2 Add create/edit form (title required, description, thumbnail upload, start-time picker), a cancel control, and a delete control on missed broadcasts
- [x] 4.3 Add a Broadcasts entry to the Studio sidebar navigation

## 5. Coming-soon card on the channel page

- [x] 5.1 Rework `components/scheduled-card.tsx` into a data-driven card: given an upcoming scheduled broadcast render thumbnail + title + countdown; otherwise render the existing static offline copy
- [x] 5.2 Wire `components/channel-view.tsx` to pass the upcoming scheduled broadcast (via `useUpcomingScheduled`) into the card, keeping the live player as the `live` branch

## 6. Tests & verification

- [x] 6.1 e2e (`tests/e2e/live-vod.spec.ts` or new spec): create a scheduled broadcast → coming-soon card shows with countdown → simulate encoder connect claims it into `preview` with metadata intact → Go live shows the live stream; cancel removes the card
- [x] 6.2 Run typecheck, lint, and build; confirm no regressions
- [x] 6.3 `openspec validate add-scheduled-broadcasts --strict`
