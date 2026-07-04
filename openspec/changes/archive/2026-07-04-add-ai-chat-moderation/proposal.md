## Why

Live chat has no moderation — no way to hide a message or stop a bad actor. This change
adds owner-only moderation built around an AI "modbot" with a manual/auto toggle, plus
the hide/ban primitives it acts through, surfaced in the Control Room (AZ-134). It is the
post-hoc AI + manual-owner layer; delegated mods (AZ-89) and a send-time profanity filter
(AZ-25) stay separate and will build on these primitives.

## What Changes

- **Hide a message**: `chat_messages.hidden_at`/`hidden_by`. Hidden messages drop out of
  the public chat (RLS), out of scoring (worker skips them), and any existing feature of
  them is retracted.
- **Ban a participant**: new `banned_participants` table, persistent per channel. A banned
  Vids.Tube user can't post (RLS restrictive policy via a `is_participant_banned` SECURITY
  DEFINER function), and the worker stops scoring/featuring banned participants (both
  origins). YouTube is hide-from-our-side only — no YouTube API enforcement.
- **Moderation queue/audit**: new `moderation_actions` table — every suggestion/action
  (target, action, reason, source ai|owner, status suggested|applied|dismissed).
- **Manual/auto modbot**: `chat_scoring_state.moderation_mode` (`manual` default | `auto`).
  The worker's Claude pass also emits hide/ban recommendations. Manual → rows stored as
  `suggested` for the owner to approve/dismiss. Auto → applied immediately and logged.
- **Owner actions + Control Room wiring**: hide/unhide, ban/unban, set-mode, approve/
  dismiss; the Control Room's Hide/Ban buttons become live and a moderation panel shows
  the suggestion queue (manual) / action log (auto) with a manual/auto switch.

- **Out of scope**: delegated mod roles (AZ-89); send-time profanity/link filter (AZ-25);
  YouTube-side enforcement (future OAuth); auto-removal from viewers' screens mid-stream
  (hidden messages vanish on next chat fetch, not pushed live).

## Capabilities

### New Capabilities

- `chat-moderation`: owner-only hide/ban primitives + the AI modbot (manual/auto) and its
  suggestion/audit queue.

## Impact

- **DB (one prod push)**: `chat_messages.hidden_at/hidden_by`; `banned_participants`;
  `moderation_actions`; `chat_scoring_state.moderation_mode`; `is_participant_banned()`
  function; chat select policy tightened to `hidden_at is null`. Owner OK before push;
  `npm run db:types` after.
- **Worker**: `worker/jobs/score.ts` skips hidden + banned, and a moderation pass writes
  suggestions (manual) or applies (auto); `worker/lib/scoring-prompt.ts` gains the
  moderation output + parse.
- **New**: `app/studio/control/page.actions.ts` (moderation actions) + hooks; a moderation
  panel in `app/studio/control/page.tsx`.
- **Reuses**: the Control Room, `getOwnedChannel` pattern (verify owner → `supabaseAdmin`),
  `participant_key` identity.
