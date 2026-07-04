## Why

The scoring bot rates every chat message on three dimensions — `engagement`, `humour`,
`contribution` (0-100 each) — and the owner can see *which* messages it featured and *why*
(`featured_messages.reason`). But the thing that actually drives the leaderboard ranking,
the per-message dimension breakdown, is computed by the model and then **thrown away**:
`applyScoreResult` sums it via `pointsFor` and writes only `viewer_scores.total_score`.
So the owner can see a viewer's rank but has no way to see *why* they're ranked there.

The model already returns the breakdown in its JSON response (`result.scores`), so
persisting and surfacing it adds **zero LLM cost** — no extra prompt, no extra output
tokens, no extra calls. This change captures what's already produced and shows it.

## What Changes

- **Persist the per-message breakdown** the model already returns. In `applyScoreResult`
  (`worker/jobs/score.ts`), collect each scored message's `engagement`/`humour`/
  `contribution`/`points` per participant and write them into the existing
  `score_events.metadata` jsonb (alongside the feature `reasons` already stored there).
  No schema migration — `metadata` is already `jsonb`.
- **New owner action `getViewerReasoningAction`** (`app/studio/control/page.actions.ts`):
  given the current stream + a leaderboard participant's identity, read that participant's
  `score_events` (filtered by `user_id` for vidstube, or `origin`+`external_author_id` for
  youtube), newest first, and return the flattened breakdown items + feature reasons +
  running total. Owner-guarded via the existing `getOwnedChannel` + `assertStreamOwned`.
- **"Why" view in the Control Room leaderboard** (`app/studio/control/page.tsx`): each
  leaderboard entry gets an expander that lazily loads the breakdown (a new
  `useViewerReasoning` hook, `enabled` only when open) and shows, per recent message, the
  three dimension scores, the points it earned, and any feature reason — so the owner can
  see exactly why a viewer sits where they do.

- **Out of scope**: persisting the *raw* model output (a debugging audit log, not
  user-facing reasoning) — deferred to a Linear issue; changing the scoring rubric or
  weights; surfacing the breakdown on the public competition overlay.

## Capabilities

### Modified Capabilities

- `chat-overlay-scoring`: the scorer now persists the per-message dimension breakdown it
  already computes, so a viewer's score is explainable rather than opaque.

### New Capabilities

- `streamer-control-room`: leaderboard entries expose the AI's per-message scoring
  reasoning on demand.

## Impact

- **DB**: none (reuses `score_events.metadata` jsonb).
- **LLM cost**: none (uses data already in the model's existing response).
- **Changed**: `worker/jobs/score.ts` (collect + write breakdown into metadata);
  `app/studio/control/page.actions.ts` (+`getViewerReasoningAction`);
  `app/studio/control/page.hooks.tsx` (+`useViewerReasoning`);
  `app/studio/control/page.tsx` (leaderboard "why" expander).
