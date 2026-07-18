## Why

Chat is merged one way: YouTube messages appear on vids.tube, but vids.tube
messages are invisible to YouTube viewers. Nightbot's send API can carry them
the other way, so chatters on vids.tube become part of the single
conversation instead of talking into a side room.

## What Changes

- **Bridge**: during a simulcast (the engaged stream has a YouTube video id),
  the worker posts each visible vids.tube chat message into the YouTube live
  chat through Nightbot, formatted `name: message` and truncated with the
  existing 400-char word-boundary rule.
- **Bounded queue with reply priority**: bridged sends share Nightbot's hard
  1-per-5.2 s pipe with command replies. Replies always send first; bridged
  messages wait in a bounded buffer (5) that drops the oldest when full —
  chat stays current instead of lagging minutes behind. Drops are logged.
- **Exclusions**: only `vidstube`-origin, non-command messages are bridged;
  bot rows and messages from banned participants never bridge. (AI moderation
  hides messages after the scoring pass — a bridged send cannot be retracted,
  which is accepted.)
- **Per-stream toggle, default ON**: `chat_scoring_state.bridge_enabled`
  (migration, default true), a "Bridge chat to YouTube" switch in the /live
  Settings tab, saved via the toolbar Save like the other scoring settings.

## Capabilities

- `bot-chat-replies` (modified)

## Out of scope

- Bridging YouTube → vids.tube (already exists via ingestion).
- Retracting bridged messages when later hidden by moderation.
- Live send verification against a real YouTube chat (owner smoke test
  AZ-157/AZ-158; the send pipe itself is already token-verified).
