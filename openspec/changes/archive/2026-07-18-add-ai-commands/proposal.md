## Why

Two AI-grounded commands make the stream feel alive for drop-in viewers:
`!ask <question>` answers from what the stream actually contains (the command
registry's FAQ content plus the live transcript), and `!catchup` summarizes the
stream so far. Both are moderated, and `!ask` follows the same suggest/auto
trust model as bans and TTS — with the owner able to approve a question while
withholding the AI's answer.

## What Changes

- **`ask_requests`** table: question, generated answer, moderation/grounding
  reasoning, status (`suggested`/`approved`/`dismissed`/`shown`),
  `include_answer` flag, requester identity. `ask_mode` (`suggest`/`auto`) on
  `chat_scoring_state` with a settings switch.
- **`!ask` builtin** (cooldown 120s): one Claude call moderates the question
  and answers it **only from the grounding** (enabled custom-command content +
  the recent transcript window); ungroundable questions get a friendly
  can't-answer reply. Failing moderation dismisses silently. Auto mode replies
  the answer in chat and queues the exchange for the overlay; suggest mode
  creates a suggestion the owner approves with an "include AI response"
  checkbox — unchecked approves the question for the overlay while the answer
  goes nowhere (not chat, not overlay).
- **Overlay Q&A display**: an approved exchange renders as the question in the
  highlight-message style with, when included, the answer below in the mirrored
  VidsBot layout (bot avatar right, bubble left), held ~10s then marked shown.
- **`!catchup` builtin** (cooldown 60s): a ≤400-char summary of the transcript
  so far, cached in the worker for 3 minutes so repeated calls cost no extra
  Claude runs; degrades to a friendly line when there is no transcript yet.

## Capabilities

### New Capabilities

- `ai-commands`: the grounded ask lifecycle with its mode/checkbox controls and
  overlay display, and the cached catchup summary.

## Non-goals / Related

- Project-links grounding arrives with `add-bot-moments` (the projects list);
  answers may only contain links already present in the grounding.
- Proactive AI messages are `add-bot-moments`.

## Impact

- Migration: `ask_requests`, `chat_scoring_state.ask_mode`, seeds for
  `ask`/`catchup` + types regen.
- `worker/lib/ask-command.ts`, `worker/lib/catchup-command.ts`, handler
  registration; `ask_mode` settings plumbing + switch; Activity "Ask requests"
  panel with the include-answer checkbox; overlay `AskExchange` component +
  playable query/mark-shown action.
- `scripts/verify-ai-commands.ts`, e2e for panel + overlay rendering.
