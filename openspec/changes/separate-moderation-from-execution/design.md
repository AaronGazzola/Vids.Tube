# Design: separate moderation from execution

## Context

Both moderated commands share the same shape today: the worker runs an AI
verdict and a failing verdict writes the request row as `dismissed` (silently,
reason recorded) before the owner ever sees it. The Activity chat renders only
`suggested` rows as actionable cards (`panels.tsx`), and the approve/dismiss
server actions gate on `.eq("status", "suggested")`. So "hidden from the
stream" and "cannot be executed" are the same code path. `!ask` additionally
skips answer generation entirely when moderation fails (`allow: false` returns
`answer: null`).

## Goals / Non-Goals

**Goals:**

- A moderation-failed request still reaches the owner as an actionable
  suggestion, visually marked as flagged with the moderation reason.
- Moderation only controls outward visibility and automation: no viewer ack,
  no overlay, no auto-approval for flagged rows.
- The owner's existing controls execute flagged requests with zero new
  actions: Approve on TTS; Answer / Question only / Dismiss on ask.

**Non-Goals:**

- No change to scoring-side moderation (`moderation_actions`,
  hide/ban suggestions) — that flow already separates suggestion from
  execution.
- No change to `!clip`, `!me`, or other unmoderated commands.
- No backfill: rows already `dismissed` by the old flow stay dismissed.
- No relaxation of the moderation prompt itself.

## Decisions

- **`flagged boolean not null default false` column, not a new status.** A
  `flagged` status value would touch every status switch, chip, and
  `.eq("status", "suggested")` gate. A boolean rides along: flagged rows are
  `suggested`, so `approveTtsAction`, `approveAskAction`, `dismissTtsAction`,
  `dismissAskAction`, the card rendering path, and the overlay pickup
  (approved-only) all work unchanged. One migration adds the column to both
  `ask_requests` and `tts_requests`.
- **Auto mode never auto-approves flagged rows.** In `auto` mode the worker
  computes `approved` only when the verdict passes; a failing verdict always
  yields `suggested` + `flagged: true`. Moderation keeps gating automation —
  the change only adds a manual owner override.
- **Flagged requests are silent toward the viewer.** No "sent for approval"
  ack and, for ask, no "I don't have that one" reply. Replying would reward
  abuse and leak moderation outcomes; silence preserves today's outward
  behavior exactly.
- **`!ask` generates the answer regardless of the moderation verdict.** The
  single AI pass keeps returning `{allow, grounded, answer, reason}` but the
  prompt now instructs it to always attempt the grounded/general-knowledge
  answer; `allow` only drives flagging. This keeps one Claude call per !ask
  and gives the owner the full Answer / Question only choice on flagged
  cards. Safe because a flagged answer publishes nowhere until the owner
  explicitly approves it.
- **Card UI: amber flag treatment on the existing suggestion cards.** The
  suggested TTS (violet) and ask (sky) cards gain a small amber "flagged"
  chip and show the moderation reason (already rendered today) when
  `flagged` is true. No new panel, no new card type.

## Risks / Trade-offs

- [Owner-approved offensive content reaches chat/overlay/TTS voice] → That is
  the point of the feature: the owner explicitly overrides per request; the
  default path still hides everything.
- [Answer generation for disallowed questions could be prompt-injected] →
  The answer is stored, never delivered, until owner approval; moderation
  reason is shown beside it so the owner sees why it was held.
- [Suggestion card backlog grows because nothing is auto-dismissed] → Cards
  collapse to normal chat rows once handled; the feed already caps at the
  latest 30 requests.

## Migration Plan

1. `npx supabase migration new add_moderation_flagged` → add `flagged` to
   `ask_requests` and `tts_requests`, `npx supabase db push`, regenerate
   `supabase/types.ts`.
2. Deploy worker + app together (additive column, default false — old code
   keeps working during the window; restart the local worker to pick it up).
3. Rollback: revert code; the column is inert with the old code paths.
