## 1. Growth mapping (`lib/plant.ts`)

- [x] 1.1 `plantShape(score, topScore, featuresCount)` → `{ growth, stemPx, leafPairs, flowers }`: `growth = topScore > 0 ? clamp01(score / topScore) : 0`; `stemPx = lerp(MIN_STEM, MAX_STEM, growth)`; `leafPairs = floor(growth * MAX_LEAF_PAIRS)`
- [x] 1.2 `features_count` adds accent flowers (`floor(featuresCount/2)`, capped); export `MIN_STEM`/`MAX_STEM`/`MAX_LEAF_PAIRS`/`MAX_FLOWERS`
- [x] 1.3 Pure (no React, no DOM) so it unit-tests

## 2. Read path (overlay)

- [x] 2.1 `app/(overlay)/overlay/[channelSlug]/competition/page.actions.ts`: `getCompetitionAction(channelSlug)` — resolve channel → live stream (`isLiveAndFresh`); `[]` when not live; else top `viewer_scores` by `total_score desc` (limit 24), resolve each via `authorFromRow`, return `ViewerScoreWithAuthor[]`
- [x] 2.2 `app/(overlay)/overlay/[channelSlug]/competition/page.hooks.tsx`: `useCompetition(channelSlug, intervalSec)` = `useQuery` `refetchInterval: max(3, intervalSec) * 1000` (default 5)

## 3. Plant component + route

- [x] 3.1 `components/overlay/plant.tsx`: stem (height `stemPx`, CSS height transition), leaf pairs on alternating sides, accent flowers, top avatar bubble (`avatarUrl ?? channelAssetUrl(avatarPath)` + initials) with the name; transparent
- [x] 3.2 `app/(overlay)/overlay/[channelSlug]/competition/page.tsx`: client; `useCompetition`; `?max=` (default 24), `?height=`; bottom-aligned flex row of `Plant`s, `topScore` = max `total_score`; nothing when empty

## 4. Studio URL

- [x] 4.1 `app/studio/overlay/page.tsx`: the "OBS Browser Sources" card now lists all three URLs (Highlights / Goals / Competition), each copyable via the shared `copy` helper

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint` (0 errors), `npm run build` pass for all new/changed files
- [x] 5.2 `scripts/verify-avatar-competition.ts` (`doppler run -- tsx`): unit-checks `plantShape` (leader = max height, monotonic, `topScore = 0` → min, flower tiers + cap) and confirms `viewer_scores` is anon-readable. (`getCompetitionAction` is a server action gated on a live stream — its live path mirrors the verified leaderboard action and is owner-checked in 5.3.)

> Reconciliation (2026-07-04): removed 1 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
