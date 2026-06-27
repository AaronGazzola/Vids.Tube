## 1. Identity migration

- [ ] 1.1 Create the migration with `npx supabase migration new add_scoring_participant_identity` (do not hand-create the file)
- [ ] 1.2 `featured_messages`: `alter column user_id drop not null`, `alter column chat_message_id drop not null`; `add column origin text not null default 'vidstube'`, `add column external_author_id text`, `add column author_name text`, `add column author_avatar_url text`; add `check (origin in ('vidstube','youtube'))`
- [ ] 1.3 `score_events`: `alter column user_id drop not null`; `add column origin text not null default 'vidstube'`, `add column external_author_id text`; add the same origin check
- [ ] 1.4 `viewer_scores`: `add column origin text not null default 'vidstube'`, `add column external_author_id text`, `add column author_name text`, `add column author_avatar_url text`; `alter column user_id drop not null`; `add column participant_key text generated always as (coalesce(user_id::text, origin || ':' || external_author_id)) stored`; `drop constraint viewer_scores_pkey`; `add primary key (stream_id, participant_key)`; add the same origin check
- [ ] 1.5 Get owner OK, then `npx supabase db push` (production), then `npm run db:types`
- [ ] 1.6 In `app/layout.types.ts` extend `FeaturedMessage`/`ViewerScore`/`ScoreEvent` usage; add a `FeaturedAuthor = { name: string; avatarUrl: string | null; avatarPath: string | null; handle: string | null }` shape used by the overlay/leaderboard, and a `ScoredMessage`/`ScoreResult` type for the engine

## 2. Scoring prompt (pure, testable)

- [ ] 2.1 `worker/lib/scoring-prompt.ts`: `buildScoringPrompt({ transcript, messages, rubric })` → string; messages carry `{ ref, origin, author, text }` with `ref` = `origin + ':' + (chatMessageId | externalAuthorId + ':' + publishedAt)`
- [ ] 2.2 Same file: `parseScoreResult(raw)` → `{ featured: { ref, score, categories, reason }[], scores: { ref, engagement, humour, contribution }[] }`, defensive (reuse `extractJson`; return empty result on failure)
- [ ] 2.3 Encode the rubric (engagement/humour/contribution, 0–100) and the Vids.Tube weighting in the prompt text + a `VIDSTUBE_MULTIPLIER` constant applied to YouTube point deltas

## 3. Worker scoring job

- [ ] 3.1 `worker/jobs/score.ts`: run for the eligible live stream while `chat_scoring_state.enabled`; renew `locked_until`; exit cleanly when the stream ends / is disabled / lock lost (mirror `transcribe.ts`)
- [ ] 3.2 Vids.Tube chat source: subscribe to `chat_messages` realtime for `stream_id` (browser-style client is not available in the worker — use `supabaseAdmin` realtime channel or poll `chat_messages` since `last_scored_at`); buffer with `origin: 'vidstube'`, identity `user_id`
- [ ] 3.3 YouTube chat source: `resolveLiveChatId(streams.youtube_video_id)` then `pollYoutubeChat`; buffer with `origin: 'youtube'`, identity `external_author_id`/`author_name`/`author_avatar_url`
- [ ] 3.4 Read the rolling transcript window from `transcript_segments` (recent N seconds for the stream)
- [ ] 3.5 Every ~10s: `buildScoringPrompt` → `runClaude` → `parseScoreResult`; map each `ref` back to its buffered message to recover full identity
- [ ] 3.6 Writes via `supabaseAdmin`: insert `featured_messages` (origin + identity, `ring_level` = author's current `viewer_scores.features_count`); upsert `viewer_scores` on `(stream_id, participant_key)` (bump `total_score`/`features_count`/`last_featured_at`); insert `score_events` (origin, points, reason in `metadata`); advance `chat_scoring_state.last_scored_at`
- [ ] 3.7 Register the job in `worker/index.ts` dispatcher alongside transcription (both run for the same eligible stream)

## 4. Overlay + leaderboard render both origins

- [ ] 4.1 `app/(overlay)/overlay/[channelSlug]/page.actions.ts`: `getFeaturedMessagesAction` returns a `FeaturedAuthor` — for `origin='vidstube'` resolve via `resolveAuthorIdentities` (avatarPath/handle), for `origin='youtube'` use `author_name`/`author_avatar_url`
- [ ] 4.2 `components/overlay/featured-avatar.tsx`: render a direct `avatarUrl` when present, else the `channelAssetUrl(avatarPath)` + initials fallback (current behavior)
- [ ] 4.3 `app/studio/overlay/page.actions.ts` `getViewerLeaderboardAction` + the leaderboard render: same origin-aware author resolution (extend `AuthorChip` use or a small inline avatar)

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit`, `npx eslint`, `npm run build` pass for all new/changed files
- [ ] 5.2 `scripts/verify-chat-scoring.ts` (`doppler run -- tsx`): insert a `youtube`-origin `featured_messages` row (null `user_id`/`chat_message_id`, external fields set) + upsert a `youtube` `viewer_scores` row twice and confirm one row keyed by `participant_key`; confirm anon read works and anon insert is denied; clean up
- [ ] 5.3 Unit-check `buildScoringPrompt`/`parseScoreResult` with a mocked `claude` JSON response (no CLI): a well-formed result yields the expected featured/score arrays; a malformed one yields an empty result
- [ ] 5.4 (deferred — needs the `claude` CLI + a live simulcast) Run `npm run worker` with `enabled` on a live stream and confirm real messages get featured/scored across both origins and the overlay animates; track as a Linear verification issue
