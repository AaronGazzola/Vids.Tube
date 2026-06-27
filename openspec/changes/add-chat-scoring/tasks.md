## 1. Identity migration

- [x] 1.1 Create the migration with `npx supabase migration new add_scoring_participant_identity` (do not hand-create the file)
- [x] 1.2 `featured_messages`: `alter column user_id drop not null`, `alter column chat_message_id drop not null`; `add column origin text not null default 'vidstube'`, `add column external_author_id text`, `add column author_name text`, `add column author_avatar_url text`; add `check (origin in ('vidstube','youtube'))`
- [x] 1.3 `score_events`: `alter column user_id drop not null`; `add column origin text not null default 'vidstube'`, `add column external_author_id text`; add the same origin check
- [x] 1.4 `viewer_scores`: drop the old `(stream_id,user_id)` PK FIRST, then `add column origin/external_author_id/author_name/author_avatar_url`, `alter column user_id drop not null`, `add column participant_key text generated always as (coalesce(user_id::text, origin || ':' || external_author_id)) stored`, `add primary key (stream_id, participant_key)`, add the origin check
- [x] 1.5 Get owner OK, then `npx supabase db push` (production), then `npm run db:types`
- [x] 1.6 In `app/layout.types.ts` add `FeaturedAuthor` (name/handle/avatarUrl/avatarPath) used by overlay + leaderboard; engine `ScoringMessage`/`ScoreResult` types live in `worker/lib/scoring-prompt.ts`

## 2. Scoring prompt (pure, testable)

- [x] 2.1 `worker/lib/scoring-prompt.ts`: `buildScoringPrompt({ transcript, messages })` → string; messages carry `{ ref, origin, author, text }`
- [x] 2.2 Same file: `parseScoreResult(raw)` → `{ featured, scores }`, defensive (reuse `extractJson`; empty result on failure; clamp scores 0–100)
- [x] 2.3 Encode the rubric (engagement/humour/contribution) + the Vids.Tube weighting in the prompt text and a `pointsFor` helper using `VIDSTUBE_MULTIPLIER`

## 3. Worker scoring job

- [x] 3.1 `worker/jobs/score.ts`: run for the eligible live stream while `chat_scoring_state.enabled`; renew `locked_until`; exit cleanly when the stream ends / disabled (mirror `transcribe.ts`)
- [x] 3.2 Vids.Tube chat source: poll `chat_messages` since a cursor via `supabaseAdmin`; buffer `origin: 'vidstube'`, identity `user_id`, handle via `resolveAuthorIdentities`
- [x] 3.3 YouTube chat source: `resolveLiveChatId(streams.youtube_video_id)` then `pollYoutubeChat` consumed in a background loop; buffer `origin: 'youtube'` with external id/name/avatar
- [x] 3.4 Read the rolling transcript window from `transcript_segments`
- [x] 3.5 Every ~10s: `buildScoringPrompt` → `runClaude` → `parseScoreResult`; map each `ref` back to its buffered message
- [x] 3.6 Writes via `supabaseAdmin`: insert `featured_messages` (origin + identity, `ring_level` = running `features_count`); read-then-update/insert `viewer_scores` by `(stream_id, participant_key)`; insert `score_events`; advance `last_scored_at`
- [x] 3.7 Register the job in `worker/index.ts` dispatcher (`Promise.all` with transcription for the same eligible stream)

## 4. Overlay + leaderboard render both origins

- [x] 4.1 `getFeaturedMessagesAction` + the realtime hook build a `FeaturedAuthor` via `lib/featured-author.ts` — `channelAssetUrl`/handle for `vidstube`, `author_name`/`author_avatar_url` for `youtube`
- [x] 4.2 `components/overlay/featured-avatar.tsx`: render a direct `avatarUrl` when present, else `channelAssetUrl(avatarPath)` + initials
- [x] 4.3 `getViewerLeaderboardAction` + new `components/featured-author-chip.tsx` render origin-aware authors; leaderboard keys by `participant_key`

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint`, `npm run build` pass for all new/changed files
- [x] 5.2 `scripts/verify-chat-scoring.ts` (`doppler run -- tsx`): youtube-origin `featured_messages` row (null `user_id`/`chat_message_id`) inserts; `viewer_scores.participant_key` generates as `youtube:<id>` and a duplicate participant insert is rejected (`23505`); anon read ok, anon insert denied (`42501`); cleaned up
- [x] 5.3 Same script unit-checks `buildScoringPrompt`/`parseScoreResult` with a mocked `claude` JSON response: well-formed → expected arrays; malformed → empty result
- [ ] 5.4 (deferred — needs the `claude` CLI + a live simulcast; tracked as **AZ-127**) Run `npm run worker` with `enabled` on a live stream and confirm real messages get featured/scored across both origins and the overlay animates
