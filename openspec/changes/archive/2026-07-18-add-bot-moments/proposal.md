## Why

The bot should occasionally speak up on its own — answering the streamer's
aloud musings, celebrating the competition, and reminding viewers what is being
built (with links) — and the stream should end with a controlled set of wrap-up
messages fired by the owner, never automatically.

## What Changes

- **`channel_projects`** table + a "Projects" manager section in Settings
  (name, blurb, domain URL, repo URL): the data source for progress updates,
  wrap-up links, and `!ask` grounding.
- **Three independent proactive toggles** on `chat_scoring_state`, each a
  Settings switch riding the one-save form, each posting to both chats
  (VidsBot + Nightbot) on its own interval while the worker is engaged:
  - **Useful info**: periodically checks the recent transcript for factual
    musings ("I wonder how many…") and answers confidently-known ones in chat.
  - **Competition status**: periodic top-three leaderboard updates (only when
    scores exist).
  - **Progress update**: periodic what-I'm-working-on posts built from the
    projects list with its links.
- **Wrap-up is manual**: a "Wrap up" button in the Activity tab (with confirm)
  stamps the request; the worker then sends whichever of three messages are
  enabled in Settings — MVP announcement (top scorer), an AI summary of what
  was achieved (from the transcript), and thanks-for-watching with project
  links — exactly once per stream.

## Capabilities

### New Capabilities

- `bot-moments`: the projects list, the three proactive moment types with
  their toggles and intervals, and the owner-fired wrap-up trio.

## Non-goals / Related

- Nothing end-of-stream fires automatically; the End action does not imply
  wrap-up.
- Intervals ship as env-overridable defaults (10 min competition, 20 min
  progress, 5 min useful-info checks), not owner UI.

## Impact

- Migration: `channel_projects`, `chat_scoring_state` toggles
  (useful_info/competition_status/progress_update + wrapup_mvp/summary/thanks),
  `streams.wrapup_requested_at`/`wrapup_done_at` + types.
- `worker/lib/moments.ts` (proactive engine + wrap-up sender + broadcast
  helper) wired into the scoring pass; `worker/lib/ask-command.ts` grounding
  gains the projects list.
- Settings switches + Projects manager; Activity "Wrap up" button + action.
- `scripts/verify-moments.ts`; e2e for the settings/projects UI + wrap-up
  button.
