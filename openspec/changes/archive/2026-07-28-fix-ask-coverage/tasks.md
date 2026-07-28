## 1. Prompt

- [x] 1.1 `worker/lib/ask-command.ts` `evaluateAsk`: replace "If you are
  unsure of an answer, you are not grounded." with the precise refusal rule
  (ungrounded only for missing streamer/channel/stream facts; confident
  general knowledge is grounded).

## 2. Regression check

- [x] 2.1 `scripts/verify-ai-commands.ts`: add a direct `evaluateAsk`
  section — general knowledge ("how many legs does an ant have") →
  allow+grounded+answer; streamer fact absent from grounding ("how tall is
  the streamer") → not grounded; abusive question → not allowed.

## 3. Verify

- [x] 3.1 `npx tsc --noEmit` passes; run the new verify section against the
  live channel grounding via `doppler run`.
