## Context

Moderation is net-new. The Control Room (AZ-134) already renders inert Hide/Ban slots;
this change makes them real and adds the AI modbot behind a manual/auto toggle. Identity
is the existing `participant_key` (`user_id` for Vids.Tube, `youtube:<ext>` for YouTube).

## Goals / Non-Goals

**Goals:** owner-only hide/ban that takes effect across chat + scoring + featuring; an AI
modbot that suggests (manual) or applies+logs (auto); a Control Room surface to act.

**Non-Goals:** delegated mods (AZ-89); send-time filter (AZ-25); YouTube-side enforcement;
live push-removal from viewers' screens.

## Decisions

- **Hide at the DB layer.** `chat_messages` gains `hidden_at`/`hidden_by`; the public
  select policy becomes `using (hidden_at is null)` so hidden text is unreadable by anon/
  authenticated clients (owner/worker use the service key and still see it). Hiding also
  deletes the message's `featured_messages` rows (retract the feature).

- **Ban enforced by RLS without leaking the list.** `banned_participants` (per channel,
  `unique(channel_id, participant_key)`) has RLS with no public read. A SECURITY DEFINER
  `is_participant_banned(p_user uuid)` lets a RESTRICTIVE insert policy on `chat_messages`
  block banned users without granting them read on the ban list. Single-tenant now, so the
  check is by `user_id` globally; `channel_id` is stored for multi-tenant later.

- **Owner writes via the verified-then-service pattern.** Like the existing overlay
  actions: each action calls `getOwnedChannel()` then uses `supabaseAdmin`. So
  `banned_participants` and `moderation_actions` need no permissive RLS policies — they are
  reached only through owner-verified server actions (and the worker's service key).

- **One Claude pass does scoring + moderation.** `buildScoringPrompt` also asks for a
  `moderation` array (`{ ref, action: 'hide'|'ban', reason }`, flag only clear abuse — spam,
  slurs, harassment; default to nothing). `parseScoreResult` parses it. The worker reads
  `chat_scoring_state.moderation_mode`: manual → insert `moderation_actions` `suggested`;
  auto → apply (hide / ban) + insert `applied`. Scoring always skips hidden + banned.

- **Control Room becomes the operator surface.** A manual/auto switch (`setModerationMode`);
  the Hide/Ban buttons call `hideMessage`/`banParticipant`; a moderation panel lists
  `suggested` actions (Approve/Dismiss) in manual mode and recent `applied`/`dismissed`
  actions (with Unhide/Unban) in auto mode. Reads via `getModerationFeedAction` (owner →
  service key).

## Risks / Trade-offs

- [Hidden message lingers on a viewer's open tab] → realtime listens to INSERT only; the
  message is gone on the next fetch/reload. Acceptable for v1; a future UPDATE listener can
  push removal.
- [AI false positive in auto mode] → every applied action is logged with its reason and is
  reversible (Unhide/Unban); default mode is manual so auto is opt-in.
- [RESTRICTIVE policy + SECURITY DEFINER] → function is `set search_path = public`,
  returns a single boolean; minimal surface.

## Migration Plan

1. One migration: the two columns, two tables, the mode column, the function, and the
   tightened chat select policy + restrictive ban policy. Owner OK → `db push` →
   `npm run db:types`.
2. Worker: prompt + parse + skip-hidden/banned + moderation apply.
3. Actions + hooks + Control Room panel.
4. Verify tsc/eslint/build, `openspec validate --strict`, and `smoke:bot` still scores.

## Open Questions

- Whether auto mode should require a confidence threshold from the model — start with
  "flag only clear abuse" wording; tune after live.
