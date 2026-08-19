# Tasks

## 1. Retire the requirement

- [x] 1.1 Remove "Leaderboard entries expose the AI's scoring reasoning" from
      `openspec/specs/streamer-control-room/spec.md`, leaving every other requirement in that file
      untouched.
- [x] 1.2 Leave `getViewerReasoningAction` and `useViewerReasoning` in place. They are retained on
      purpose for the studio chatter page, not overlooked.
- [x] 1.3 Confirm no other spec references the control room leaderboard reasoning.

## 2. Land it

- [x] 2.1 `openspec validate --strict`.
