## Context

AZ-111 shipped the highlight overlay + the `featured_messages` / `viewer_scores` /
`score_events` / `chat_scoring_state` tables, all public-read / service-write. The
worker can transcribe a live stream into `transcript_segments` (AZ-115) and read
YouTube live chat via `worker/lib/youtube-chat.ts` + `streams.youtube_video_id`
(AZ-125). What's missing is the scorer: the thing that reads the conversation and
decides what to feature and how to score. This change adds it as a second worker job
under the existing dispatcher, and extends the AZ-111 tables so YouTube chatters
(who have no `auth.users` row) can participate. The owner confirmed the
**inline-columns** identity model over a separate participants table.

## Goals / Non-Goals

**Goals:**
- One worker job that scores transcript + both chats with `claude -p` and writes the
  featured/score tables, gated by `chat_scoring_state.enabled`.
- A schema that represents both Vids.Tube users and account-less YouTube chatters.
- The overlay + leaderboard render either author origin.

**Non-Goals:**
- The bot replying into chat (future).
- The avatar-competition overlay (AZ-114) and goal overlays (AZ-117).
- Tuning the rubric to perfection — ship a sane default, iterate live.

## Decisions

- **Inline identity columns; re-key `viewer_scores` by a generated `participant_key`.**
  (Owner-chosen.) `user_id` becomes nullable on all three tables and they gain `origin`
  (`'vidstube'|'youtube'`), `external_author_id`, `author_name`, `author_avatar_url`;
  `featured_messages.chat_message_id` becomes nullable (YouTube features reference no
  `chat_messages` row — the nullable `unique` still prevents double-featuring a
  Vids.Tube message). `viewer_scores` cannot keep `(stream_id, user_id)` as its PK once
  `user_id` is null for YouTube, so it gains
  `participant_key text generated always as (coalesce(user_id::text, origin || ':' ||
  external_author_id)) stored` and is re-keyed to `(stream_id, participant_key)`; the
  worker upserts on that. *Alternative — a `participants` table:* cleaner normalization
  but a join on every overlay/leaderboard read and more churn on live tables; rejected
  for this single-tenant, two-origin case. The PK swap is safe because `viewer_scores`
  is effectively empty (scoring has never run).

- **The scorer is a second worker job, not a new process.** `worker/jobs/score.ts`
  runs under the same dispatcher as `transcribe.ts`, for the same eligible live stream,
  sharing the `chat_scoring_state.enabled` gate and `locked_until` lock. *Rationale:*
  the worker already owns the stream lifecycle and the transcript; scoring is another
  consumer of it. The two jobs run concurrently for one stream.

- **Merge both chats into one origin-tagged buffer.** Vids.Tube chat arrives via the
  `chat_messages` realtime subscription (origin `vidstube`, identity = `user_id`);
  YouTube chat via `pollYoutubeChat(resolveLiveChatId(streams.youtube_video_id))`
  (origin `youtube`, identity = `external_author_id`/`author_name`/`author_avatar_url`).
  Both push into a bounded in-memory buffer of "new since last score". The cursor
  (`chat_scoring_state.last_scored_at`) marks how far chat has been scored so a restart
  doesn't double-score.

- **Score on an interval with a pure prompt contract.** Every ~10s the job builds a
  prompt from the rolling transcript window + the new message batch + a rubric, calls
  `runClaude`, and parses strict JSON: `{ featured: [{ ref, score, categories, reason
  }], scores: [{ ref, engagement, humour, contribution }] }` where `ref` identifies a
  message (origin + id/external id). **Vids.Tube messages are weighted higher** both in
  the rubric text and via a points multiplier applied to YouTube deltas. The
  prompt-building and response-parsing are pure exported functions in
  `worker/lib/scoring-prompt.ts` so they unit-test without the CLI. *Trade-off:* the
  model picks `ref`s from what it's given; the job maps `ref` back to the buffered
  message to recover full identity before writing.

- **Writes mirror AZ-111 semantics, plus origin/identity.** Insert `featured_messages`
  with `origin` + identity fields and `ring_level = ` the author's current
  `viewer_scores.features_count` (snapshotted, as AZ-111 specified). Upsert
  `viewer_scores` on `(stream_id, participant_key)`, bumping `total_score`,
  `features_count`, `last_featured_at`. Insert `score_events` with `origin`, `points`,
  and the reason in `metadata`. Advance `last_scored_at`; renew `locked_until`.

- **Overlay/leaderboard resolve author by origin.** For `origin = 'vidstube'`, resolve
  via `resolveAuthorIdentities` → `channelAssetUrl` (a storage path). For `origin =
  'youtube'`, use the stored `author_name` + `author_avatar_url` (already a full URL).
  `getFeaturedMessagesAction` and the studio leaderboard action return a normalized
  author shape carrying either an avatar *path* or a direct *url*;
  `components/overlay/featured-avatar.tsx` and `AuthorChip` render whichever is present.
  *Rationale:* YouTube avatars are absolute `yt3.ggpht.com` URLs, not channel-asset
  paths, so the avatar source genuinely differs by origin.

- **Migration + types follow the repo norm.** `npx supabase migration new
  add_scoring_participant_identity`; `db push` after owner OK (production); `npm run
  db:types`. The `claude` CLI runs only on the worker; no app dependency, no API key.

## Risks / Trade-offs

- [Double-scoring on restart] → the cursor (`last_scored_at`) plus the
  `featured_messages.chat_message_id` unique (for Vids.Tube) bound duplicates; YouTube
  re-features are bounded by only scoring messages newer than the cursor.
- [Model returns malformed JSON or bad refs] → the parse function is defensive (returns
  an empty result on parse failure, drops `ref`s it can't map); a bad cycle is skipped,
  never corrupts state.
- [PK swap on `viewer_scores`] → safe only because the table is empty; the migration
  asserts/relies on that. If it somehow had rows, the generated column still computes
  for existing `user_id` rows (`origin` defaults to `'vidstube'`).
- [Quota/cost of frequent `claude -p`] → the interval (~10s) bounds call rate; the
  subscription has no per-call billing. Tune the interval if needed.
- [Migration alters live production tables] → additive columns + nullable relaxations +
  one PK swap; gated on explicit owner OK before `db push`, verified by read-back.

## Migration Plan

1. `npx supabase migration new add_scoring_participant_identity`; author the column
   adds, nullable relaxations, the generated `participant_key`, and the
   `viewer_scores` PK swap.
2. Owner OK, then `npx supabase db push` (production), then `npm run db:types`.
3. Build `worker/lib/scoring-prompt.ts`, `worker/jobs/score.ts`, the overlay/leaderboard
   render tweaks; verify with `scripts/verify-chat-scoring.ts` (schema/RLS + a
   YouTube-origin row + the `participant_key` upsert) and a mocked-`claude` parse test.
4. Rollback: the columns are additive; reverting the PK requires a follow-up migration.
   The worker job is gated by `enabled` and not deployed — disabling it is the runtime
   "rollback".

## Open Questions

- Exact rubric weights and category set — ship a default (engagement / humour /
  contribution; Vids.Tube multiplier e.g. 1.5×) and tune against real streams.
- Whether to also feature super-chats automatically (a strong signal from AZ-125's
  message types) — note for a later iteration.
