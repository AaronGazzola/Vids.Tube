## Context

The command layer, reply delivery, suggest/auto plumbing (banMode/ttsMode), the
Activity panel pattern, and the overlay poll/mark pattern (TTS) all exist. The
scoring loop already reads a transcript window (fetchTranscriptWindow).

## Decisions

- ask_requests: id, channel_id, stream_id, chat_message_id, participant_key,
  origin, author_name, question, answer (null when ungrounded), reason, status
  (suggested/approved/dismissed/shown), include_answer boolean default true,
  created_at, approved_at, shown_at. RLS: owner select all; anon select
  approved/shown (overlay); service-role writes + guarded public mark-shown.
- One Claude call returns JSON {allow, grounded, answer, reason}. Grounding
  text = enabled custom commands ("!kw — description: response") + last 40
  transcript segments. Prompt forbids links not present in the grounding and
  instructs second-person, <=350 chars.
- Auto mode: insert approved (include_answer true) + chat reply with the
  answer. Suggest: insert suggested; approval action takes includeAnswer and
  delivers the chat reply only when included (origin-local via a service-side
  insert for vidstube / Nightbot enqueue is worker-only, so for youtube askers
  the approved answer is delivered by the worker: a per-pass sweep sends
  answers for approved+include_answer rows whose answer_delivered_at is null —
  add that column — keeping Nightbot access in the worker).
- Overlay: AskExchange component — question via HighlightedMessage style
  (reuse its card look with a simple wrapper) and the mirrored bot answer;
  10s hold then markAskShownAction (approved→shown). Poll 2s like TTS.
- catchup: in-memory {streamId, text, generatedAt} cache, 180s TTL; prompt
  summarizes the transcript so far (<=380 chars); truncation guard.
- Seeds: ask cooldown 120 sort 31; catchup cooldown 60 sort 32.
- ask_mode on chat_scoring_state default suggest + "Auto-answer !ask (vs
  suggest)" SwitchRow; StreamSettings/Input/Form plumbing like ttsMode.

## Risks / Trade-offs

- Suggest-mode chat delivery happens on the worker's next pass (seconds of
  delay) — acceptable, keeps all outbound chat in the worker.
- The single-call moderate+answer keeps cost at one Claude run per !ask.
