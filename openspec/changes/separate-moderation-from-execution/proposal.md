# Separate moderation from execution for !ask and !tts

## Why

A moderation-failed `!ask` or `!tts` is currently recorded as `dismissed` and
vanishes — the owner never sees it and cannot rescue it. Moderation is doing
two jobs at once: hiding the request from chat/overlay AND blocking its
execution. The owner wants cheeky-but-fine requests (e.g. "!ask why is chatter
X smelly") to reach the Activity chat as a flagged suggestion they can still
approve, with moderation only controlling default visibility, never the
owner's ability to execute.

## What Changes

- Moderation failure no longer dismisses: flagged `!ask` / `!tts` requests are
  stored as `suggested` with a new `flagged` boolean and the moderation reason,
  so they surface on the existing Activity-chat suggestion cards with the same
  Approve / Dismiss controls.
- Flagged requests stay invisible outward by default: no ack reply to the
  viewer, nothing on the overlay, and auto mode never auto-approves a flagged
  request — approval is always an explicit owner click.
- The `!ask` AI pass answers the question (when groundable) even when
  moderation flags it, so the owner can approve a flagged ask with the answer
  included, question-only, or dismiss it — same three controls as today.
- Suggestion cards mark flagged requests visually (chip + moderation reason)
  so the owner knows why the bot held it back.
- New migration adds `flagged boolean not null default false` to
  `ask_requests` and `tts_requests`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ai-commands`: moderation-failed `!ask` questions become flagged suggestions
  (silent to the viewer, never auto-approved) instead of silent dismissals;
  the AI pass still produces a grounded answer for flagged questions.
- `tts-requests`: moderation-failed `!tts` requests become flagged suggestions
  (silent to the viewer, never auto-approved) instead of silent dismissals;
  the owner card shows the flagged state and reason.

## Impact

- `supabase/migrations/` — new migration for the `flagged` column on
  `ask_requests` and `tts_requests`; regenerate `supabase/types.ts`.
- `worker/lib/ask-command.ts` — verdict prompt answers independently of the
  moderation verdict; flagged insert path replaces the dismissed path.
- `worker/lib/tts.ts` — flagged insert path replaces the dismissed path;
  reply logic keyed off flagged, not just status.
- `app/(app)/live/page.actions.ts` — ask/tts feed actions select `flagged`.
- `app/(app)/live/page.types.ts` (feed item types) and
  `app/(app)/live/panels.tsx` — flagged chip + reason on suggestion cards.
- Existing approve/dismiss actions are untouched — flagged rows are
  `suggested`, so the current gating already lets the owner execute them.
