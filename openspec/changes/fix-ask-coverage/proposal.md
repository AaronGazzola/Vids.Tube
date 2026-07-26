# Fix !ask answer coverage (over-refusal)

## Why

`!ask` still refuses answerable questions on stream (Linear AZ-165). The
prompt was already updated to allow general knowledge, but the instruction
"If you are unsure of an answer, you are not grounded" makes the model treat
ordinary uncertainty as a refusal reason, and there is no repeatable check
covering the general-knowledge path, so regressions go unnoticed until a
live stream.

## What Changes

- `worker/lib/ask-command.ts` `evaluateAsk` prompt: the blanket
  unsure-means-ungrounded line is replaced with a precise rule — refuse as
  ungrounded only when the question needs a streamer/channel/stream fact the
  grounding lacks; confident general knowledge is always grounded.
- `scripts/verify-ai-commands.ts` gains a direct `evaluateAsk` coverage
  check (no worker needed): general-knowledge answered, streamer-fact
  without grounding refused, abusive question disallowed.

## Capabilities

### Modified Capabilities

- `ai-commands`: `!ask` answers confident general knowledge instead of
  refusing on uncertainty; coverage is regression-checked by script.

## Impact

- Worker must be restarted to pick up the prompt (it always is before a
  stream). Live end-to-end behavior is confirmed at the next stream via the
  AZ-158 rehearsal.
