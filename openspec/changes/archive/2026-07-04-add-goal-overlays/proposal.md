## Why

The go-live overlay stack (AZ-124) needs the likes/subscribers/viewers goal bars that
already exist in the standalone `../Stream Overlays` repo. That repo is already
Next.js 15 and reads the YouTube Data API, and Vids.Tube now has the YouTube read
layer (AZ-125) plus a transparent overlay route group (AZ-111). So this change ports
the goal overlays in, wires them to the shared YouTube client and the existing
`streams.youtube_video_id` mapping, and lets the standalone repo be retired.

## What Changes

- **New `stream_goals` table** (one migration): per-stream targets + a start-time
  baseline — `stream_id` (PK, FK `streams`), `subs_goal`/`likes_goal`/`viewers_goal`,
  nullable `baseline_subs`/`baseline_likes`/`baseline_viewers` + `started_at`,
  `updated_at`. Public-read, owner/service-write (mirrors the AZ-111 RLS split). The
  YouTube video mapping is **reused** from `streams.youtube_video_id` — not duplicated.
- **Pure goal math** (`lib/goals.ts`): `computeGoalProgress(counts, baseline, goals)`
  → per-metric `{ current, target, total, goal, pct, reached }`, with subs/likes
  measured as gain from the start baseline and viewers as the absolute live count
  (the exact semantics ported from the Stream Overlays `/api/poll`).
- **Goals overlay route** under the existing transparent `(overlay)` group:
  `/overlay/[channelSlug]/goals` honoring `?bars=`, `?interval=`, `?height=`, `?demo=1`.
  Ports the `GoalBar` (subs bar, likes bar, viewers ring, icons, rainbow "goal reached"
  animations + glow) and the draggable `DemoStage` from the Stream Overlays repo.
- **Overlay read path**: a `getGoalProgressAction(channelSlug)` server action resolves
  channel → live stream → YouTube ids + goals, fetches metrics via `lib/youtube`, runs
  `computeGoalProgress`, and returns the per-metric progress; a `useGoalProgress` hook
  polls it on an interval (the `useLiveStream` pattern). The worker is **not** involved.
- **Studio control** on `/studio/overlay`: a "Goals" card with the three target inputs,
  a Start button (snapshots the baseline), and the copyable goals OBS URL. The YouTube
  video field already exists from AZ-125.

- **Out of scope**: the worker (goals don't need it), Vids.Tube-native metrics
  (YouTube-only for now), and per-client poll memoization (a future quota optimization).

## Capabilities

### New Capabilities

- `goal-overlays`: the likes/subs/viewers goal bars — the `stream_goals` model, the
  pure progress math, the transparent `/overlay/[channelSlug]/goals` route + demo mode,
  the YouTube-backed read path, and the studio goal controls.

### Modified Capabilities

(none — the YouTube mapping is reused from `streams`; no existing requirements change.)

## Impact

- **DB**: one migration adding `stream_goals` (`npx supabase migration new`);
  `npm run db:types` regenerates `supabase/types.ts`. Push hits **production** Supabase —
  requires owner OK before `db push`.
- **New files**: `lib/goals.ts`; `app/(overlay)/overlay/[channelSlug]/goals/{page.tsx,
  page.hooks.tsx,page.actions.ts}`; `components/overlay/goal-bar.tsx` +
  `components/overlay/goal-demo-stage.tsx`; rainbow keyframes in `app/globals.css`;
  studio goal actions/hooks/UI; a `scripts/verify-goal-overlays.ts` smoke check; new
  types in `app/layout.types.ts`.
- **Reuses**: `lib/youtube.ts` (`fetchVideoData`/`fetchSubs`/`parseVideoId`, AZ-125),
  `streams.youtube_video_id`/`youtube_channel_id`, the transparent `(overlay)` layout +
  `useChannel`/`useLiveStream`, `supabaseAdmin`, and the owner-guard pattern.
- **Retires**: once shipped, the standalone `Stream Overlays` repo can be archived
  (coordinate with AZ-122 repo-retirement).
- No changes to existing chat, streams, ingest, transcription, or scoring behavior.
