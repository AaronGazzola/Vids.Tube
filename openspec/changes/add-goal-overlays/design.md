## Context

The `../Stream Overlays` repo (Next.js 15) renders likes/subs/viewers goal bars for an
OBS browser source, reading the YouTube Data API with an API key and keeping state
(videoId, baseline, goals) in a `data/state.json`. Vids.Tube now has: the shared
YouTube read client `lib/youtube.ts` (AZ-125), the stream→YouTube-video mapping on
`streams.youtube_video_id`/`youtube_channel_id` (AZ-125), and a transparent
chrome-free `(overlay)` route group with `useChannel`/`useLiveStream` (AZ-111). So the
port is mostly: move the visual components in, replace `state.json` with a Supabase
table for the goals/baseline, and compute progress server-side from the shared client.

## Goals / Non-Goals

**Goals:**
- The three goal overlays render in OBS from this repo, driven by real YouTube metrics.
- Owner sets targets + captures a baseline from studio; demo mode for layout testing.

**Non-Goals:**
- The worker (goals are app-only).
- Vids.Tube-native metrics (YouTube-only for now).
- Quota memoization across overlay clients (future).

## Decisions

- **Reuse the YouTube mapping; add only `stream_goals`.** The video/channel ids already
  live on `streams` (AZ-125), so this change adds just the goal state: a 1:1
  `stream_goals` table keyed by `stream_id` with the three targets, the nullable
  start-baseline triplet, and `started_at`. *Alternative — columns on `streams`:* 8
  goal-specific columns would bloat the hot `streams` row that ingest/lifecycle code
  loads constantly; a side table keeps goals isolated and is read only by the goals
  path. *Alternative — reuse the Stream Overlays `state.json`:* loses multi-stream
  keying and RLS; rejected. RLS mirrors AZ-111: `select using (true)` (public-read),
  no public insert/update (owner/service-write).

- **Goal math is a pure, ported function.** `lib/goals.ts`
  `computeGoalProgress(counts, baseline, goals)` reproduces the Stream Overlays
  `/api/poll` semantics exactly: for `subs`/`likes`, `current = now - baseline`,
  `target = goal - baseline`; for `viewers`, `current = now`, `target = goal`; `pct =
  clamp(current/target*100, 0, 100)`, `reached = pct >= 100`. Pure → unit-testable with
  mocked counts (no network). *Rationale:* the math is the part most worth pinning down
  and the part that doesn't need YouTube to verify.

- **Read path is a server action + `useQuery` interval, not a `/api/poll` route.**
  `getGoalProgressAction(channelSlug)` resolves channel → live stream → `youtube_video_id`
  + `stream_goals`, calls `fetchVideoData` + `fetchSubs`, runs `computeGoalProgress`,
  and returns `{ active, isLive, metrics }`. `useGoalProgress(channelSlug, intervalSec)`
  wraps it in `useQuery` with `refetchInterval` (min 3s, default 10s). *Rationale:*
  matches the repo's existing `useLiveStream` polling idiom and keeps the YouTube key
  server-side; the overlay client never touches the API directly. The action returns
  `active: false` (overlay renders nothing) when the channel isn't live or has no
  `youtube_video_id`/goals.

- **The goals route drops into the existing transparent group.** AZ-111 already made
  `(overlay)` chrome-free and transparent, so `app/(overlay)/overlay/[channelSlug]/goals`
  needs no new layout. It parses `?bars=subs,likes,viewers`, `?interval=`, `?height=`,
  `?demo=1` (same params as the source), renders `GoalBar` per metric, and in demo mode
  renders the draggable `GoalDemoStage` instead — preserved for OBS layout testing
  without a live stream.

- **Components port nearly verbatim.** `GoalBar` (bars/ring + icons + rainbow classes)
  and `DemoStage` move to `components/overlay/goal-bar.tsx` /
  `components/overlay/goal-demo-stage.tsx`, adapting imports to this repo (`cn`, etc.);
  the rainbow `@keyframes` + `.rainbow-*` classes are added to `app/globals.css` next to
  the AZ-111 overlay keyframes. The metric/progress types move to `app/layout.types.ts`
  (`GoalMetric`, `MetricProgress`, `GoalProgressResponse`).

- **Studio sets goals + snapshots a baseline.** `setGoalsAction(streamId, targets)` and
  `startGoalsAction(streamId)` (owner-checked) write `stream_goals`; `startGoalsAction`
  reads the current YouTube counts via `lib/youtube` and stores them as the baseline +
  `started_at`, so subs/likes progress is measured from the moment the owner starts.
  Surfaced as a "Goals" card on `/studio/overlay` with three inputs, a Start button, and
  the copyable `/overlay/<slug>/goals` URL. The YouTube video field is already there
  (AZ-125).

- **Migration + types follow the repo norm.** `npx supabase migration new
  add_stream_goals`; `db push` after owner OK (production); `npm run db:types`.

## Risks / Trade-offs

- [No baseline set → subs/likes bars look wrong] → `computeGoalProgress` treats a null
  baseline as 0 (absolute), and the studio Start button captures it; the action returns
  `active: false` until goals exist.
- [YouTube quota from polling] → default interval 10s (min 3s), one broadcast; well
  within quota. Memoization across clients is deferred.
- [Subscriber count is YouTube-rounded] → inherent to the API (small channels near
  exact); the studio warns if a subs goal is below the current count, as the source did.
- [Migration hits production] → additive (one new table); gated on owner OK before
  `db push`, verified by read-back.

## Migration Plan

1. `npx supabase migration new add_stream_goals`; create the table + RLS + public-read
   policy.
2. Owner OK, then `npx supabase db push` (production), then `npm run db:types`.
3. Build `lib/goals.ts`, the goals route + components + CSS, the studio controls; verify
   with `scripts/verify-goal-overlays.ts` (pure math + schema/RLS).
4. Rollback: the table is additive and read only by the goals path; a follow-up
   migration dropping it fully reverts.

## Open Questions

- Whether to also drive goals from Vids.Tube-native metrics later (native viewers via
  presence, native "likes"/follows) — out of scope; revisit after follow/subscribe
  (AZ-27) exists.
- Exact default goal values — ship the source's defaults (subs 1000 / likes 500 /
  viewers 100), owner-editable.
