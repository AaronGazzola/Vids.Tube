## 1. Data model

- [x] 1.1 Create the migration with `npx supabase migration new add_stream_goals` (do not hand-create the file)
- [x] 1.2 `stream_goals`: `stream_id uuid primary key references streams(id) on delete cascade`, `subs_goal int not null default 1000`, `likes_goal int not null default 500`, `viewers_goal int not null default 100`, `baseline_subs int`, `baseline_likes int`, `baseline_viewers int`, `started_at timestamptz`, `updated_at timestamptz not null default now()`
- [x] 1.3 Enable RLS; add a single `select using (true)` policy (public-read), no insert/update policies → owner/service-write only
- [x] 1.4 Get owner OK, then `npx supabase db push` (production), then `npm run db:types`
- [x] 1.5 In `app/layout.types.ts` add `StreamGoals` Row type, `GoalMetric = 'subs'|'likes'|'viewers'`, `MetricProgress`, and `GoalProgressResponse = { active: boolean; isLive: boolean; metrics: Record<GoalMetric, MetricProgress> | null }`

## 2. Pure goal math (`lib/goals.ts`)

- [x] 2.1 `computeGoalProgress(counts, baseline, goals)` → `Record<GoalMetric, MetricProgress>`; subs/likes use `current = now - baseline` / `target = goal - baseline`; viewers use `current = now` / `target = goal`; null baseline → 0
- [x] 2.2 `pct = clamp(round(current / max(target,1) * 100), 0, 100)`, `reached = pct >= 100`; `total` = absolute now (subs/likes) or live count (viewers), `goal` = the entered target
- [x] 2.3 Export `DEFAULT_GOALS = { subs: 1000, likes: 500, viewers: 100 }`

## 3. Read path (overlay)

- [x] 3.1 `app/(overlay)/overlay/[channelSlug]/goals/page.actions.ts`: `getGoalProgressAction(channelSlug)` — resolve channel (`getChannelBySlugAction`) → live stream → `youtube_video_id`/`youtube_channel_id` + `stream_goals`; if not live / no video / no goals return `{ active: false, isLive, metrics: null }`; else `fetchVideoData` + `fetchSubs`, `computeGoalProgress`, return `{ active: true, isLive, metrics }`
- [x] 3.2 `app/(overlay)/overlay/[channelSlug]/goals/page.hooks.tsx`: `useGoalProgress(channelSlug, intervalSec)` = `useQuery` with `refetchInterval: max(3, intervalSec) * 1000`

## 4. Goals overlay route + components

- [x] 4.1 `components/overlay/goal-bar.tsx`: port `GoalBar` from `../Stream Overlays/app/overlay/GoalBar.tsx` (subs horizontal bar, likes vertical bar, viewers progress ring + SVG masks, metric icons, glow); adapt imports to `cn`
- [x] 4.2 Add the rainbow `@keyframes` (`rainbow-bar-x`, `rainbow-bar-y`, `rainbow-hue`, `rainbow-spin`) + `.rainbow-bar-h/.rainbow-bar-v/.rainbow-ring/.rainbow-icon` classes to `app/globals.css` (from the source `globals.css`)
- [x] 4.3 `components/overlay/goal-demo-stage.tsx`: port `DemoStage` (draggable/resizable preview with sample metrics)
- [x] 4.4 `app/(overlay)/overlay/[channelSlug]/goals/page.tsx`: client; parse `?bars=`, `?interval=`, `?height=`, `?demo=1`; in demo render `GoalDemoStage`; else `useGoalProgress` and render a `GoalBar` per selected metric (nothing when `!active`)

## 5. Studio goal controls

- [x] 5.1 `app/studio/overlay/page.actions.ts`: `setGoalsAction(streamId, { subs, likes, viewers })` (owner-checked upsert into `stream_goals`) and `startGoalsAction(streamId)` (owner-checked; `fetchVideoData`+`fetchSubs` for the stream's `youtube_video_id`, store as `baseline_*` + `started_at`); extend `getOverlayContextAction` to return current goals + baseline
- [x] 5.2 `app/studio/overlay/page.hooks.tsx`: `useSetGoals`, `useStartGoals` mutations (unwrap `ActionResult`, toast)
- [x] 5.3 `app/studio/overlay/page.tsx`: a "Goals" card — three target inputs bound to `useSetGoals`, a Start button (`useStartGoals`) that warns if a subs goal is below the current count, and the copyable `/overlay/<channelSlug>/goals` OBS URL

## 6. Verification

- [x] 6.1 `npx tsc --noEmit`, `npx eslint`, `npm run build` pass for all new/changed files
- [x] 6.2 `scripts/verify-goal-overlays.ts` (`doppler run -- tsx`): unit-check `computeGoalProgress` with mocked counts (gain-from-baseline for subs/likes, absolute for viewers, clamping, `reached`); and schema/RLS — service upsert a `stream_goals` row, anon read ok, anon insert denied (`42501`), clean up

> Reconciliation (2026-07-04): removed 2 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
