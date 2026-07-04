## 1. Migration

- [x] 1.1 `npx supabase migration new add_chat_moderation`: `chat_messages` add `hidden_at timestamptz`, `hidden_by text`; drop+recreate the chat select policy as `using (hidden_at is null)`
- [x] 1.2 Same migration: `banned_participants` (id, channel_id fk, participant_key, origin, user_id fk, external_author_id, author_name, reason, banned_by, created_at, `unique(channel_id, participant_key)`), RLS enabled, no public policies
- [x] 1.3 Same migration: `moderation_actions` (id, stream_id fk, target_kind, action, chat_message_id fk, participant_key, origin, user_id, external_author_id, author_name, reason, source, status default 'suggested', created_at, decided_at), RLS enabled, no public policies
- [x] 1.4 Same migration: `chat_scoring_state` add `moderation_mode text not null default 'manual'`; `is_participant_banned(p_user uuid)` SECURITY DEFINER; RESTRICTIVE insert policy on `chat_messages` blocking banned users
- [x] 1.5 Owner OK → `doppler run -- npx supabase db push` → `npm run db:types`

## 2. Worker

- [x] 2.1 `worker/lib/scoring-prompt.ts`: add a `moderation` output array (`{ ref, action, reason }`) to the rubric + `parseScoreResult`; export `ModerationFlag`
- [x] 2.2 `worker/jobs/score.ts` `fetchNewVidstube`: `.is("hidden_at", null)`; fetch the channel's banned `participant_key` set and drop banned messages from the batch (both origins)
- [x] 2.3 `worker/jobs/score.ts`: read `chat_scoring_state.moderation_mode`; apply the moderation flags — manual → insert `moderation_actions` `suggested`; auto → hide message / insert ban + insert `applied`

## 3. Actions + hooks

- [x] 3.1 `app/studio/control/page.actions.ts`: `hideMessageAction`/`unhideMessageAction` (hide also deletes the message's `featured_messages`), `banParticipantAction`/`unbanParticipantAction`, `setModerationModeAction`, `approveSuggestionAction`/`dismissSuggestionAction`, `getModerationFeedAction` — all `getOwnedChannel()`-verified then `supabaseAdmin`
- [x] 3.2 `app/studio/control/page.hooks.tsx`: mutations for each + `useModerationFeed(streamId)` (poll 8s) + `useModerationMode`

## 4. Control Room wiring

- [x] 4.1 Enable the Hide (per chat message) and Ban (per leaderboard author) buttons to call the mutations
- [x] 4.2 Moderation panel: manual → `suggested` actions with Approve/Dismiss; auto → recent `applied`/`dismissed` with Unhide/Unban; a manual/auto switch (`setModerationMode`)

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint app components worker scripts` (0 errors), `npm run build:local` pass
- [x] 5.2 `openspec validate add-ai-chat-moderation --strict`
- [x] 5.3 `scripts/verify-moderation.ts` (`doppler run -- npx tsx`): service can hide a message (excluded from anon read) + insert/read a ban + a banned user's insert is denied by RLS (`42501`/`0`); `is_participant_banned` returns true; clean up
- [x] 5.4 `npm run smoke:bot` still scores (regression: moderation parse doesn't break scoring)

> Reconciliation (2026-07-04): removed 1 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
