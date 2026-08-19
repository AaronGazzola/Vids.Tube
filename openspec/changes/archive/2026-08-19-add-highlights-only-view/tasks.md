# Tasks

## 1. Command messages reach the scorer

- [x] 1.1 In `worker/jobs/score.ts`, stop discarding the command messages: keep the batch that entered
      `processCommands` for scoring rather than reassigning it to that function's return value. Assign
      the return value to a separate name, since it is still what the moderation and bridge steps below
      it expect, and confirm by reading those steps which of the two each one needs.
- [x] 1.2 Leave `processCommands` itself untouched. Execution, cooldowns, per-stream limits, unknown
      command replies and the `command_events` log all keep their current behaviour; only the scoring
      input changes.
- [x] 1.3 Update the comment above `processCommands` in `worker/lib/commands.ts`, which currently states
      that command messages are "consumed here and never scored". That sentence becomes false in 1.1 and
      is the thing that made the ticket's premise wrong in the first place.
- [x] 1.4 `tests/unit/` — a test asserting the batch handed to the scoring prompt still contains a
      command message, and that the host's message is still absent from it. Both halves matter: the
      `!isHost` filter must survive the change that removes the command filter.

## 2. The highlights-only filter

- [x] 2.1 In `app/(app)/live/panels.tsx`, add local state to `ChatPanel` for the filter, defaulting to
      off, held in the component rather than in a store or the layout config so it cannot outlive the
      page or reach a broadcast.
- [x] 2.2 Filter the rendered list with the `featuredByMsg` map the panel already builds, so no query is
      added. The unfiltered path must keep rendering the identical rows it does now.
- [x] 2.3 Put the toggle in the panel's existing header row beside the "Live chat" label, so the tab
      gains no new furniture above the chat.
- [x] 2.4 Three empty states, distinct: no chat at all, chat but nothing featured while the filter is on,
      and the loading skeleton. The middle one is the new one and must not reuse the "No messages yet."
      text, which would read as the chat having broken.

## 3. Cover it

- [x] 3.1 `tests/unit/highlights-filter.test.tsx`: with the filter off every message renders; with it on
      only the featured ones do; with it on and nothing featured the nothing-featured text appears and
      the no-messages text does not; a featured command message renders under the filter.
- [x] 3.2 Confirm by reading the rendered row that a filtered message still carries its moderation,
      highlight, TTS, ask and clip affordances, rather than asserting only on the message text.

## 4. Land it

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 4.2 Run `openspec validate --strict` and archive.
