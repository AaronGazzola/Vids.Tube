## Why

Scoring has only ever run live, against a handful of broadcasts. 164 of 168 videos have never been scored, so 140 of 148 memberships hold zero experience, zero level and zero credits. Every community feature being built — leaderboards, levels, credits, the returning-chatter welcome, the recognition dossier — reads numbers that currently reflect four broadcasts out of 168.

The chat is complete and the identities are correct. What is missing is a pass that turns 4945 stored messages into ratings.

## What Changes

- The scoring rubric moves out of the worker's prompt and into a versioned configuration, so the same wording drives live scoring and the backfill and can be changed deliberately rather than by editing a prompt string.
- Every rating records which configuration version produced it.
- A backfill pass scores stored chat for one broadcast or for the whole history, writing the same rating and per-broadcast records the live path writes, then recomputing the affected memberships.
- The pass is repeatable: re-running it for a configuration clears that broadcast's ratings and rewrites them, so a changed configuration can be applied to everything without hand edits.
- Bot messages and the host are excluded, matching the live path.
- Moderation is not part of the backfill. Historical messages are already public and old; retroactively flagging them would be acting on a decision nobody asked for.

## Capabilities

### New Capabilities

- `chat-scoring-backfill`: scoring stored chat for a broadcast or the whole history, idempotently, with the results feeding the existing membership rebuild.

### Modified Capabilities

- `chat-scoring-engine`: the rubric becomes a versioned configuration shared by the live scorer and the backfill, and every rating records the version that produced it.

## Impact

- Database: `score_events` gains a scoring-version column.
- Shared: a new configuration module holding the rubric, criteria and weights, imported by both the worker and the backfill.
- Worker: the live scorer reads its rubric from the configuration and stamps the version onto the ratings it writes. Its behaviour is otherwise unchanged.
- Scripts: a new backfill pass, plus the existing membership rebuild run over whatever it touched.
- Cost: about 4945 messages across 168 broadcasts, batched per broadcast.
