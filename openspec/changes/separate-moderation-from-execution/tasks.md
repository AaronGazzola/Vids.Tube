# Tasks: separate moderation from execution

## 1. Schema

- [ ] 1.1 Create migration via `npx supabase migration new add_moderation_flagged`
      adding `flagged boolean not null default false` to both `ask_requests`
      and `tts_requests`; push with `npx supabase db push`.
- [ ] 1.2 Regenerate `supabase/types.ts` with
      `npx supabase gen types typescript --project-id <project-ref>` and
      confirm both Row types include `flagged: boolean`.

## 2. Worker

- [ ] 2.1 In `worker/lib/tts.ts` `ttsHandler`: replace the
      `status = "dismissed"` branch — a failing verdict now inserts
      `status: "suggested"`, `flagged: true`, reason recorded, no
      `approved_at`; auto mode computes `approved` only when
      `verdict.allow`. Keep the ack replies exclusively on the passing
      branches (flagged inserts send no reply).
- [ ] 2.2 In `worker/lib/ask-command.ts` `evaluateAsk`: reword the prompt so
      the model always attempts the answer (moderation verdict and
      grounded/answer are independent outputs), and stop forcing
      `answer: null` semantics when `allow` is false — return the parsed
      answer whenever present.
- [ ] 2.3 In `worker/lib/ask-command.ts` `askHandler`: replace the
      `!verdict.allow` dismissed-insert branch with an insert of
      `status: "suggested"`, `flagged: true`, `answer: verdict.answer`
      (nullable), `include_answer: !!verdict.answer`, reason recorded, no
      viewer reply; flagged rows bypass the `ask_mode === "auto"` approval
      path entirely. Passing-question paths (grounded, ungroundable) are
      unchanged.

## 3. App

- [ ] 3.1 In `app/(app)/live/page.actions.ts`: add `flagged: boolean` to
      `TtsFeedItem` and `AskFeedItem`, and select + map `flagged` in
      `getTtsFeedAction` and `getAskFeedAction`.
- [ ] 3.2 In `app/(app)/live/panels.tsx`: on the suggested TTS card and the
      suggested ask card, render an amber "flagged" chip next to the
      moderation reason when the item has `flagged: true` (existing
      Approve / Dismiss and Answer / Question only / Dismiss controls
      unchanged — flagged rows are `suggested`, so they already get the
      controls).

## 4. Verify

- [ ] 4.1 Run `npx tsc --noEmit` and confirm no type errors.
- [ ] 4.2 Extend `scripts/verify-ai-commands.ts` (or run its existing flow)
      to assert: an abusive `!ask` inserts `suggested` + `flagged: true`
      with no bot reply row, and `approveAskAction`-style update
      (`status` suggested → approved) still succeeds on the flagged row;
      an abusive `!tts` inserts `suggested` + `flagged: true` with no
      reply, and flipping it to `approved` leaves it eligible for the
      synthesis query (`status = approved`, `audio_path is null`).
