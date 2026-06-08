## Why

The VOD chat-replay panel on `/watch/[videoId]` can only be dismissed permanently — clicking its X removes it for the rest of the session with no way to bring it back. Viewers who want more room for the video, then change their mind, are stuck. This is the remaining scope of Linear AZ-20 (the per-session scoping and timeline anchoring already shipped in `fix-stream-session-chat-scope`).

## What Changes

- Replace the replay panel's permanent dismiss with a **collapse / re-expand** toggle: the viewer can collapse the panel to a compact control and expand it again at will.
- When the panel is collapsed, the video player **reclaims the freed space** (goes full width) so collapsing is useful, not just hiding.
- Persist the collapsed/expanded preference across navigations and reloads (e.g. `localStorage`), defaulting to expanded.
- No database, API, or schema changes — this is a client-side UI change only.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vod-chat-replay`: the replay panel's visibility control changes from a one-way permanent dismiss to a reversible collapse/expand, the player reclaims space when collapsed, and the collapsed/expanded state persists.

## Impact

- `components/chat-replay.tsx`: replace the dismiss (`onDismiss`/X) affordance with a collapse control; render a compact re-expand control in the collapsed state.
- `app/watch/[videoId]/page.tsx`: replace `replayDismissed` state with a persisted `replayCollapsed` state; make the player container span full width when collapsed.
- Tests: extend `tests/e2e/live-vod.spec.ts` (collapsing hides the message list but keeps a re-expand control; re-expanding restores the panel).
- Related Linear: completes AZ-20.
