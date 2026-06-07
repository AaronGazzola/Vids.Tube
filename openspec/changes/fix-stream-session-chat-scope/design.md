## Context

The data model is already correct for per-session scoping: `chat_messages.stream_id`
and `videos.source_stream_id` both reference a single `streams` row. The defect is
purely in the go-live ingest handler, which reuses a row instead of starting a new
session.

Today, `app/api/ingest/live/route.ts` (ready hook) selects the channel's most-recent
`streams` row regardless of `status` and, if one exists, **updates it** back to
`live` (resetting `started_at`, clearing `ended_at`, refreshing `last_seen_at`). The
`wasLive` flag only decides whether `started_at` is reset — the row's `id` is reused
unconditionally. Consequences:

- `getLiveStreamAction` (`app/layout.actions.ts`) returns that reused `id`; `LiveChat`
  reads `chat_messages WHERE stream_id = id`, so the previous session's chat reappears.
- The offline hook (`app/api/ingest/offline/route.ts`) writes a VOD with
  `source_stream_id = id`; reusing the row means several VODs share one chat set and a
  `started_at` that drifts from the actual recording — Linear AZ-20 root cause #2.

`STALE_MS = 60_000` is defined privately in `app/layout.actions.ts` and used by
`getLiveStreamAction` to treat a `live` row whose `last_seen_at` is too old as ended.
The ingest route needs the same threshold to tell a reconnect apart from a new session.

## Goals / Non-Goals

**Goals:**

- One `streams` row per broadcast session: a new go-live after a session has ended (or
  gone stale) creates a new row with a new `id`.
- Live chat for a new broadcast starts empty; no carryover from a prior session.
- Each VOD's `source_stream_id` is unique, so VOD chat replay is scoped to and anchored
  on its own session's `started_at`.
- A single shared `STALE_MS` consumed by both the read path and the ingest route.
- Genuine reconnects/keep-alives within a live session still update the same row (no new
  row, no `started_at` reset, no chat loss).

**Non-Goals:**

- No database schema or migration change (FKs already scope correctly).
- The collapsible / re-expandable chat-replay panel UI (remains AZ-20 follow-up).
- Ticket-gating of live chat (AZ-39).
- A grace window to merge rapid not-ready/ready flaps into one session (see Risks).

## Decisions

### Decision: Reconnect vs. new session is decided by `status === 'live'` AND fresh `last_seen_at`

The ready hook treats the most-recent row as the **same** session only when it is
`live` and `last_seen_at` is within `STALE_MS`. Otherwise it inserts a new row.

- **Why:** This mirrors exactly what the read path already considers "still live"
  (`getLiveStreamAction`'s staleness check). Using one rule on both sides means the
  thing the UI shows as live is the same thing ingest treats as an ongoing session — no
  divergence. `ended`/`idle` rows are unambiguously prior sessions; a `live` row that has
  gone stale means the previous ingest died, which is a new session on reconnect.
- **Alternative considered:** Always insert a new row on every ready hook. Rejected
  because MediaMTX can fire ready repeatedly (keep-alive/short reconnect) within one
  broadcast; that would fragment one broadcast into many rows, many VODs, and reset chat
  mid-stream.
- **Alternative considered:** Add a nullable `session_id`/segment column and keep reusing
  rows. Rejected as unnecessary schema churn — a new row per session already gives every
  downstream consumer (chat, VOD) correct scoping for free.

### Decision: Extract `STALE_MS` to a shared module

Move the constant out of `app/layout.actions.ts` into a shared location (e.g.
`lib/stream.ts` or `lib/live.ts`) and import it in both `getLiveStreamAction` and the
ingest live route.

- **Why:** The reconnect/new-session decision and the read-path staleness check must use
  the identical threshold; duplicating the literal `60_000` invites drift.

### Decision: End the orphaned stale-`live` row when starting a new session

When the ready hook starts a new session because the prior row was a stale `live` row,
it also sets that prior row to `status='ended'` (no `ended_at` reconstruction needed
beyond marking it ended).

- **Why:** Otherwise the channel would have two `live` rows; `getLiveStreamAction`
  returns most-recent so the UI is fine, but the offline hook (which targets the most
  recent `live` row) and any future queries over `live` rows would be ambiguous. Marking
  the orphan ended keeps state honest.
- **Note:** We deliberately do NOT manufacture a VOD for the crashed session here — the
  offline hook never ran, recording finalize never happened, so there is no recording to
  attach. That remains out of scope.

### Decision: No changes to the read/replay code paths

`getLiveStreamAction`, `useLiveChat`, `getStreamChatReplayAction`, and
`lib/chat-replay.ts` already filter by `stream_id`/`source_stream_id` and offset from
`started_at`. Once row reuse stops, they produce correct per-session results unchanged.
This change adds tests over those paths rather than modifying them.

## Risks / Trade-offs

- **Mid-broadcast not-ready/ready flaps fragment a session** → The offline hook already
  marks `ended` and spawns a VOD on every not-ready, so flaps are a pre-existing
  robustness issue independent of this change. After this change, a post-`ended` ready
  starts a fresh (empty) chat rather than silently merging. Mitigation: if real-world
  flapping proves disruptive, add a short grace window before not-ready ends a session —
  tracked separately, not in this change.
- **Two consumers must agree on `STALE_MS`** → Mitigated by the shared-module extraction;
  a single import removes the chance of drift.
- **Existing prod data already has reused rows** → This change is forward-only; it does
  not retro-split historical rows. Already-corrupted historical VOD replays are not
  repaired by this change (acceptable — test data, per AZ-20).
