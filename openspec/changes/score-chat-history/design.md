## Context

The live scorer batches chat every 10 seconds, sends the recent transcript plus the batch to the model, and gets back a 0-100 rating on engagement, humour and contribution for each message, a small set of messages to feature, and any moderation flags. `pointsFor` sums the three dimensions and applies a 1.5 multiplier to site-typed messages. Those points become a `score_events` row per participant per batch and a running `viewer_scores` row per participant per broadcast. `recompute_membership` then derives lifetime experience by summing `viewer_scores` per broadcast, and level and credits follow from that.

The rubric that drives all of this is a string constant inside the worker's prompt module. Nothing records which wording produced a given rating.

Phase B left 4945 stored messages across 168 broadcasts, every YouTube message carrying YouTube's own message id. Phase C made memberships and credits rebuild from ratings, so anything this pass writes flows through to standing without further work.

## Goals / Non-Goals

**Goals:**

- Turn stored chat into ratings for every broadcast, using the same method as live scoring.
- Make the rubric a thing that can be changed deliberately and whose effect can be attributed.
- Make the pass repeatable, so a changed rubric can be applied to the whole history.
- Keep the blast radius of a re-run to ratings and what derives from them.

**Non-Goals:**

- Any UI for editing the configuration. That is AZ-217, and it depends on this pass proving itself first.
- Featuring historical messages on the overlay. Featuring is a live act; a backfill has no overlay to put anything on.
- Moderating historical chat.
- Changing how points, levels or credits are calculated.

## Decisions

### The rubric becomes a versioned configuration, shared by both paths

A configuration module holds the rubric text, the three criteria and the site-message multiplier, plus a version string. The worker imports it instead of holding its own copy, so live scoring and the backfill cannot drift apart.

The version is a hand-written string bumped when the wording changes, not a hash. A hash would change on whitespace edits and produce meaningless version churn; the point of the version is to mark a deliberate decision about what the community rewards.

### Ratings record their version

`score_events` gains a `scoring_version` column. That makes three things possible: knowing which rubric produced a chatter's standing, clearing exactly one version's ratings before a re-run, and comparing two configurations on the same broadcast without one overwriting the other's evidence.

The alternative, putting the version in the existing `metadata` json, avoids a migration but makes the delete-before-rerun query a json filter over the whole table.

### The backfill writes what the live path writes

The pass produces `score_events` and `viewer_scores` rows of the same shape the live scorer produces, then calls `recompute_membership`. It does not write memberships or credits directly.

This is the same principle Phase C settled on: one route to a number. If the backfill computed experience itself, live and backfilled standing could disagree, and the ledger's earning line would depend on which path last touched a membership.

### One broadcast is one unit of work

Chat is scored a broadcast at a time, in transcript-sized batches within it, because the rubric rates a message against what the streamer was saying. Scoring messages without their transcript context would produce a different and worse judgement than the live path made.

A broadcast is also the natural unit for idempotence: re-running clears that broadcast's ratings for the configuration and rewrites them, so a partial run can simply be repeated.

### Moderation is dropped from the backfill

The live rubric asks the model to flag abuse so the bot can hide or ban. Historical messages have been public for up to a year. Retroactively hiding them, or banning someone for something said in 2025, is a decision nobody has asked for, and it cannot be undone from the ratings. The backfill asks for ratings only.

## Risks / Trade-offs

- **Historical ratings will not match what live scoring would have produced at the time** → Accepted explicitly by the owner. The transcript context is reconstructed from stored segments rather than the live window, and the model differs from the one that ran then. The version stamp records which rubric produced what, which is the honest form of this.
- **A full run costs a model call per batch across 168 broadcasts** → The pass takes a broadcast filter so a configuration is tried on one broadcast before anything else is touched, which is the sequence the owner asked for.
- **Re-running with a changed configuration rewrites every chatter's standing** → That is the intent, and Phase C's ledger makes it safe: earnings are re-derived and spends are untouched. The pass reports how many memberships changed so a surprising result is visible.
- **The rubric rewards site-typed messages 1.5 times more, and history is almost entirely YouTube** → Nothing to fix; it means the multiplier barely affects historical standing. Worth knowing when comparing a historical chatter against a future one.
- **A broadcast with no transcript would be rated without context** → Every one of the 168 has a transcript, and the pass refuses a broadcast that does not.
