## 1. Growth mapping (`lib/plant.ts`)

- [ ] 1.1 `plantShape(score, topScore)` → `{ growth, stemPx, leafPairs, flowers }`: `growth = topScore > 0 ? clamp(score / topScore, 0, 1) : 0`; `stemPx = lerp(MIN_STEM, MAX_STEM, growth)`; `leafPairs`/`flowers` step up at score tiers
- [ ] 1.2 Add an optional `featuresAccent(featuresCount)` (or a param) so `features_count` adds accent flowers; export `MIN_STEM`/`MAX_STEM` constants
- [ ] 1.3 Keep it pure (no React, no DOM) so it unit-tests

## 2. Read path (overlay)

- [ ] 2.1 `app/(overlay)/overlay/[channelSlug]/competition/page.actions.ts`: `getCompetitionAction(channelSlug)` — resolve channel (`getChannelBySlugAction` or a direct `channels` query) → live stream (most-recent fresh `streams` via `isLiveAndFresh`); if not live return `[]`; else select top `viewer_scores` by `total_score desc` (limit 24), resolve each via `authorFromRow` (`resolveAuthorIdentities` for `vidstube` user_ids), return `ViewerScoreWithAuthor[]`
- [ ] 2.2 `app/(overlay)/overlay/[channelSlug]/competition/page.hooks.tsx`: `useCompetition(channelSlug, intervalSec)` = `useQuery` with `refetchInterval: max(3, intervalSec) * 1000` (default 5)

## 3. Plant component + route

- [ ] 3.1 `components/overlay/plant.tsx`: props `{ author: FeaturedAuthor | null, score, topScore, featuresCount }`; compute `plantShape`; render a stem (height `stemPx`, CSS height transition), leaf pairs on alternating sides, accent flowers, and a top avatar bubble (`Avatar` with `author.avatarUrl ?? channelAssetUrl(author.avatarPath)` + initials) with the name below; transparent
- [ ] 3.2 `app/(overlay)/overlay/[channelSlug]/competition/page.tsx`: client; resolve channel→live stream; `useCompetition`; `?max=` (default 24), `?height=`; render a bottom-aligned flex row of `Plant`s ordered by score, `topScore` = the max `total_score`; render nothing when not live / empty

## 4. Studio URL

- [ ] 4.1 `app/studio/overlay/page.tsx`: add the copyable `/overlay/<channelSlug>/competition` URL next to the existing overlay + goals URLs (reuse the `copy` helper)

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit`, `npx eslint`, `npm run build` pass for all new/changed files
- [ ] 5.2 `scripts/verify-avatar-competition.ts` (`doppler run -- tsx`): unit-check `plantShape` (leader = max height, monotonic, `topScore = 0` → min, clamping); insert a couple `viewer_scores` rows of each origin and confirm `getCompetitionAction` returns them with the correct `FeaturedAuthor` per origin, then clean up
- [ ] 5.3 (deferred — needs a live stream with scores + OBS; tracked as a Linear verification issue) Confirm `/overlay/<channelSlug>/competition` renders the garden, plants grow as scores update, and both origins show the right avatar
