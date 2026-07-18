## Why

The Activity tab stacks separate panels (TTS requests, Ask requests, Clip
markers — and in demo, the tabbed "VidsBot actions") above the chat, while the
requests themselves are already visible as `!command` messages *in* the chat.
The owner wants one surface: act on requests inline where they appear, the way
feature-suggested messages already work — with color-coded cards per request
type — and the Wrap up button in the bottom toolbar next to End stream.

## What Changes

Applies to **both** the real Activity tab and the demo (kept in lockstep):

- **Inline request cards in the chat**: a chat message tied to a suggested
  TTS request renders as a violet card with Approve/Dismiss; one tied to a
  suggested ask renders as a sky-blue card showing the AI answer preview with
  three buttons — **Answer** (approve + include the AI answer), **Question
  only** (approve without it), **Dismiss**. After the owner acts (or the
  worker auto-handles it), the card relaxes to normal styling with a
  color-matched status chip — the same pattern as highlight suggestions
  (amber). Feed actions gain `chat_message_id` so rows join to their chat
  messages.
- **Clip styling**: a chat message tied to a clip marker renders with emerald
  accenting and the marker's stream timestamp — no live panel.
- **Panels removed**: the TTS and Ask panels are gone; the clip markers panel
  appears only when no stream is active (the post-stream shortlist stays).
  The demo's "VidsBot actions" component is removed.
- **Wrap up in the toolbar**: the real Wrap up button (confirm dialog
  unchanged) sits in the bottom toolbar immediately left of "End stream"
  while live; the demo places its wrap-up button in the same toolbar spot.

## Capabilities

- `tts-requests` (modified) · `ai-commands` (modified) · `clip-command`
  (modified) · `bot-moments` (modified) · `live-demo-mode` (modified)

## Out of scope

- Worker/pipeline behavior (statuses, moderation, synthesis, delivery are
  untouched — this is an owner-surface redesign).
