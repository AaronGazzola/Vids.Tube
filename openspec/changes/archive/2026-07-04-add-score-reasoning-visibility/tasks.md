## 1. Persist the breakdown (worker)

- [x] 1.1 `worker/jobs/score.ts`: extend the `Participant` type in `applyScoreResult` with
  `items: { text: string; engagement: number; humour: number; contribution: number; points: number }[]`
- [x] 1.2 In the `result.scores` loop, push one item per scored message onto its
  participant: `{ text: m.text.slice(0, 200), engagement: s.engagement, humour: s.humour, contribution: s.contribution, points: pointsFor(s, m.origin) }`
- [x] 1.3 In the `score_events` insert, change `metadata` to
  `{ reasons: p.features.map((f) => f.reason), items: p.items }` (keep the existing
  `reasons` key so nothing that reads it breaks)
- [x] 1.4 No behavior change to `viewer_scores`/`featured_messages`; no new model call

## 2. Read action (owner-guarded)

- [x] 2.1 `app/studio/control/page.actions.ts`: add `ViewerReasoning` type
  (`items: { text, engagement, humour, contribution, points, createdAt }[]`,
  `featureReasons: string[]`, `totalPoints: number`)
- [x] 2.2 `getViewerReasoningAction({ streamId, userId, origin, externalAuthorId })`:
  `getOwnedChannel()` + `assertStreamOwned(streamId)`; query `score_events` `.eq("stream_id")`
  and either `.eq("user_id", userId)` (vidstube) or `.eq("origin","youtube").eq("external_author_id", externalAuthorId)` (youtube),
  `.order("created_at", { ascending: false }).limit(20)`
- [x] 2.3 Flatten `metadata.items` across rows (defensive: tolerate rows whose `metadata`
  has no `items`, i.e. pre-change events), collect `metadata.reasons`, sum `points`;
  return `ViewerReasoning`. Expected-empty returns `{ items: [], featureReasons: [], totalPoints: 0 }`

## 3. Hook + UI

- [x] 3.1 `app/studio/control/page.hooks.tsx`: `useViewerReasoning(streamId, identity, enabled)`
  wrapping `getViewerReasoningAction` (`queryKey ["viewer-reasoning", streamId, participantKey]`,
  `enabled`, `refetchInterval: 8000` while open)
- [x] 3.2 `app/studio/control/page.tsx`: each leaderboard entry (`LeaderboardRow`) gets a
  "why?" toggle button; open state held per-row
- [x] 3.3 When open, render the breakdown: per item the three dimensions (e/h/c), the points
  it earned, and the truncated message text; list feature reasons if any; inline skeleton
  while loading. Closed by default so no extra queries fire until asked

## 4. Verification

- [x] 4.1 `npx tsc --noEmit`, `npx eslint app worker` (0 errors), `npm run build:local` pass
- [x] 4.2 `npm run dryrun -- --ticks 3 --keep` + throwaway check: 6/6 `score_events` rows had
  `metadata.items` with numeric e/h/c/points (sample: `engagement 65, humour 10, contribution 60, points 135`);
  kept stream cleaned up
- [x] 4.4 `openspec validate add-score-reasoning-visibility --strict`

Owner-run visual check (expand a leaderboard entry and confirm the breakdown renders) tracked
in Linear as AZ-137, not as a build task.
