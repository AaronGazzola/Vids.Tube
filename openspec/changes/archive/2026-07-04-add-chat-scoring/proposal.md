## Why

The highlight overlay (AZ-111) and the data model behind it are built, and the
worker can transcribe a live stream (AZ-115) and read YouTube chat (AZ-125) — but
nothing yet decides *which* messages to feature or *how many points* a viewer earns.
This change adds the brain: a worker job that reads the transcript and both chats,
scores participation with `claude -p`, and writes `featured_messages` /
`viewer_scores` / `score_events`. It is the missing middle that makes the overlay run
automatically end to end.

## What Changes

- **Identity extension on the scoring tables** (one migration): so account-less
  YouTube chatters can be featured and scored alongside Vids.Tube users. On
  `featured_messages`, `viewer_scores`, and `score_events`: make `user_id` nullable and
  add `origin` (`'vidstube'|'youtube'`), `external_author_id`, `author_name`,
  `author_avatar_url`. `featured_messages.chat_message_id` becomes nullable (YouTube
  features have no `chat_messages` row). `viewer_scores` is re-keyed from
  `(stream_id, user_id)` to `(stream_id, participant_key)`, where `participant_key` is a
  generated column `coalesce(user_id::text, origin || ':' || external_author_id)`. RLS
  stays public-read / service-write.
- **Worker scoring job** (`worker/jobs/score.ts`, sibling to the transcription job
  under the dispatcher): merges Vids.Tube chat (Supabase realtime on `chat_messages`)
  and YouTube chat (the AZ-125 poller) into a buffer tagged by `origin` + identity,
  reads the rolling transcript window, and every ~10s calls `claude -p` with the
  transcript + new message batch + a rubric. The model returns which messages to
  feature (score, categories, reason) and per-author score deltas; **Vids.Tube messages
  are weighted higher** than YouTube. The job writes `featured_messages`, upserts
  `viewer_scores` on `participant_key`, inserts `score_events`, advances the cursor, and
  is gated by `chat_scoring_state.enabled` with the `locked_until` lock.
- **Overlay + leaderboard render both origins**: the featured-message and
  `viewer_scores` read paths resolve a Vids.Tube author via `channelAssetUrl` and a
  YouTube author from the stored `author_name` + `author_avatar_url` (a full URL), so
  YouTube highlights actually show.

- **Out of scope** (separate/ future): the bot posting its own replies into chat
  (future), the avatar-competition overlay (AZ-114), and the goal overlays (AZ-117).

## Capabilities

### New Capabilities

- `chat-scoring-engine`: the worker job that scores the transcript + both chats with
  `claude -p` and writes the featured/score tables, the identity extension that lets
  account-less YouTube chatters participate, and the overlay/leaderboard rendering of
  both author origins.

### Modified Capabilities

(none in `openspec/specs/` — the AZ-111 `chat-scoring` data model lives in its own
still-active change; this change layers the engine + identity extension as new
requirements rather than editing that change's spec.)

## Impact

- **DB**: one migration altering `featured_messages` / `viewer_scores` / `score_events`
  (additive columns + nullable relaxations + a PK swap on the near-empty
  `viewer_scores`). `npm run db:types` regenerates `supabase/types.ts`. Push hits
  **production** Supabase — requires owner OK before `db push`.
- **New files**: `worker/jobs/score.ts`, `worker/lib/scoring-prompt.ts` (pure
  build/parse), a `scripts/verify-chat-scoring.ts` smoke check; edits to the overlay
  action + `featured-avatar` + the studio leaderboard; new types in `app/layout.types.ts`.
- **Reuses**: `transcript_segments` (AZ-115), `worker/lib/youtube-chat.ts` +
  `streams.youtube_video_id` (AZ-125), `runClaude` + the dispatcher + lock helpers
  (AZ-112 foundation), the `chat_messages` realtime pattern, `supabaseAdmin`, and the
  AZ-111 tables/overlay.
- **Runtime**: the job needs the `claude` CLI on the worker machine (already required);
  no new app dependency. No `ANTHROPIC_API_KEY`.
