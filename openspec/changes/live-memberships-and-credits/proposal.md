## Why

A chatter who speaks for the first time during a broadcast currently gets nothing: the worker writes a rating for their message, but their channel and membership only appear later, when a batch script is run by hand. There is no way for someone to join, take part, and see their standing move — and credits, which are meant to be earned and spent inside a single broadcast, have never been earned at all. `credits` is an opaque balance that no code writes.

The community features being built on top of this need the opposite: participation that lands immediately, and totals that can be rebuilt from raw chat at any time without losing what a chatter has already spent.

## What Changes

- A chatter's channel and membership are created the moment they first speak in a broadcast, not by a batch script afterwards.
- Membership totals (XP, level, message count, broadcasts attended, streaks) are refreshed for every scored participant at the end of each scoring batch, so a chatter's standing moves while the broadcast is running.
- **BREAKING** `memberships.credits` stops being a standalone balance. Credits become the sum of a new ledger: positive lines derived from XP at 1 credit per 10 XP, negative lines written when a chatter spends. The balance is calculated, never stored as a single mutable number.
- A full re-score rebuilds every earning line and leaves every spending line untouched, so re-scoring can never take away what a chatter has already spent.
- A switch in the `/live` settings tab controls how much is fetched when an unknown chatter first speaks. It defaults to fetching the real YouTube handle and high-resolution avatar immediately; the alternative creates a minimal channel from the display name already on the message and enriches it after the broadcast.
- `scripts/create-unclaimed-channels.ts` becomes a backfill tool for historical chatters only. Live creation is the primary path.

## Capabilities

### New Capabilities

- `credit-ledger`: credits as a ledger of earning and spending lines, with the balance derived on read, earnings rebuilt by a re-score, and spends never touched by one.
- `live-chatter-onboarding`: creating a chatter's channel and membership on their first message of a broadcast, in either enrichment mode, plus the post-broadcast pass that enriches minimally-created channels.

### Modified Capabilities

- `memberships`: the credits requirement changes from "a balance recompute must preserve" to "a value derived from the credit ledger"; a new requirement makes membership totals refresh live during a broadcast rather than only when a script runs.
- `unclaimed-channels`: channel creation for a chatter who appears live moves to the live path; the batch job's remit narrows to chatters who exist only in archived history.
- `broadcast-setup`: the settings tab carries the new chatter-enrichment switch, stored per channel.

## Impact

- Database: a new ledger table; `channels` gains the enrichment-mode setting; `recompute_membership` stops writing `credits` and instead maintains that membership's earning line.
- Worker: `worker/jobs/score.ts` creates channels and memberships for unknown chatters and refreshes memberships after each scoring batch; `worker/lib/streams.ts` resolves the enrichment mode.
- Scripts: `scripts/create-unclaimed-channels.ts` is scoped to archived-only chatters; a new post-broadcast enrichment pass; a one-off derivation of earning lines for the 148 existing memberships.
- UI: the `/live` settings tab gains the switch; anything reading `memberships.credits` reads the derived balance instead.
- Depends on the host participant class only in that the host must never be onboarded as a chatter; that exclusion already exists in the ingest loop.
