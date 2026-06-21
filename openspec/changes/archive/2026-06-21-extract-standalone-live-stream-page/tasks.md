## 1. LiveStreamView component

- [x] 1.1 Create `components/live-stream-view.tsx` as a `"use client"` component taking `{ slug: string }`, using `useChannel(slug)`, `useLiveStream(channel?.id)`, and `useUpcomingScheduled(channel?.id)` from `app/[channelSlug]/page.hooks`
- [x] 1.2 Compute `isLive = stream?.status === "live" && !!stream.hls_path`, `streamId = isLive ? stream.id : (upcomingScheduled?.id ?? null)`, and `upcoming = upcomingScheduled ?? null`
- [x] 1.3 Render the live state: reuse the `lg:grid-cols-[1fr_340px]` layout from `channel-view.tsx` — `LiveStage` + stream title (`<h2>`) + `CollapsibleDescription` on the left, `LiveChat` (with `streamId`) on the right
- [x] 1.4 Render the scheduled/preview state: same two-column layout with `ScheduledCard` (passing `upcoming`) on the left and `LiveChat` (with `streamId` = the scheduled/preview row id) on the right, so pre-stream chat is usable
- [x] 1.5 Render loading skeletons while the channel/stream queries are pending (do not redirect during pending)
- [x] 1.6 When channel/stream queries have settled and there is no `live`/`preview`/upcoming `scheduled` stream (or the slug has no channel), `router.replace("/" + slug)`

## 2. Live route

- [x] 2.1 Create `app/[channelSlug]/live/page.tsx` mirroring `app/[channelSlug]/page.tsx`: read `useParams<{ channelSlug: string }>()` and render `<LiveStreamView slug={params.channelSlug} />`

## 3. Strip live from the channel page

- [x] 3.1 In `components/channel-view.tsx`, remove the `<section className="mt-8">` live/scheduled block (the `isLive ? LiveStage+chat : ScheduledCard` branch)
- [x] 3.2 Remove the now-unused `isLive` and `streamId` locals and the `useLiveStream` / `useUpcomingScheduled` calls
- [x] 3.3 Remove the now-unused imports (`LiveStage`, `LiveChat`, `ScheduledCard`, `CollapsibleDescription`, and the `useLiveStream` / `useUpcomingScheduled` hook imports), leaving the header, branding dialogs, and `Videos` section intact

## 4. Verification

- [x] 4.1 Typecheck and lint pass for the changed files (`npx tsc --noEmit -p tsconfig.json` clean for the new/edited files; `npx eslint` clean). Full `npm run build` page-data collection requires Supabase env vars not present in this shell (`supabaseUrl is required` on the untouched `/api/ingest/offline` route) — re-run with the project's Doppler/`.env` to confirm the build.
- [x] 4.2 Manually confirm: `/[channelSlug]/live` shows the player + chat when live; shows the countdown + usable chat when scheduled/preview; redirects to `/[channelSlug]` when there is no stream; and `/[channelSlug]` (and `/`) no longer show the live player, countdown, or chat inline
