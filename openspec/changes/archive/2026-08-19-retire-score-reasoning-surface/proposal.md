## Why

The `streamer-control-room` spec states that the control room leaderboard lets the owner reveal the
AI's reasoning behind a chatter's score. No control room leaderboard exists. The `/studio/control`
route was deleted when stream operations were folded into `/live`, and the reasoning was not rebuilt
on the Activity tab.

The requirement has therefore described absent behaviour ever since. That is the fault worth fixing:
the reasoning read and its hook survived the fold with no caller, so the code reads as an orphan while
the spec reads as shipped, and neither is true. Working that out cost most of a session.

The reasoning itself is not being abandoned. It answers a question worth answering — why a chatter's
score moved, message by message — and it belongs on a chatter detail page in the studio, read at
leisure, rather than on the live page which is read in seconds while broadcasting. That page is a
separate ticket, and the code stays in place for it.

## What Changes

- The requirement describing the control room leaderboard reasoning is removed, because the surface it
  describes does not exist.
- No code is deleted. The reasoning read, its hook and the scoring detail they return are kept for the
  studio chatter page.

## Capabilities

### Removed Capabilities

- `streamer-control-room`: the leaderboard reasoning requirement goes, the surface having been removed
  when the control room was folded into `/live`.

## Impact

- One requirement removed from the `streamer-control-room` spec. No other requirement in that spec is
  touched.
- **Not in this change:** any code. The reasoning read and hook stay exactly as they are, unreferenced,
  held by the studio chatter page ticket rather than by a spec requirement.
- **Not in this change:** the studio chatter page itself, and the per-chatter card being built on the
  live page, which shows standing and recall rather than scoring justification.
