## Context

A broadcast becomes an authored object only at encoder-connect today: the ingest
`live` hook (`app/api/ingest/live/route.ts`) inserts a fresh `streams` row in
`preview`, and `decideGoLive` (`lib/stream.ts`) picks between reconnect / new /
new-after-stale based solely on the channel's most-recent row. The owner authors
title/description/thumbnail in the preview gate, then clicks Go live
(`goLiveAction`). The channel page (`components/channel-view.tsx`) shows a live
player + chat when `status === 'live'`, otherwise the static `ScheduledCard`
placeholder. The `channel-live` spec currently mandates that placeholder carry **no**
scheduling data or countdown.

Scheduling (AZ-28) adds a future start time and a "coming soon" surface on top of
that flow, with **manual** go-live preserved. AZ-53 is complete and is the
foundation this builds on. Notifications/reminders (AZ-29) and auto-go-live are out
of scope.

## Goals / Non-Goals

**Goals:**
- Let the owner create a future broadcast ahead of time (title, description,
  thumbnail, start time) and manage upcoming/past broadcasts from Studio.
- Show viewers a coming-soon card (thumbnail + title + countdown) when a scheduled
  broadcast is upcoming, replacing the static offline placeholder.
- When the encoder connects for a scheduled broadcast, carry its authored metadata
  into the existing preview→Go-live flow rather than starting a blank session.

**Non-Goals:**
- Auto-go-live at the scheduled time (go-live stays a manual owner action).
- Reminders / "notify me" / push / email (AZ-29).
- Privacy/visibility tiers (every broadcast is public, deferred).
- Trimming the preview lead-in out of the resulting VOD.

## Decisions

### A scheduled broadcast is a `streams` row in a new `scheduled` status

Rather than a separate `scheduled_broadcasts` table, a scheduled broadcast is a
`streams` row created ahead of time with `status = 'scheduled'`, a
`scheduled_start_at`, and its authored `title` / `description` / `thumbnail_path`
already set. This reuses the existing thumbnail→R2 path, VOD inheritance, and the
one-row-per-session model, so go-live and VOD finalization need no new wiring — the
row simply pre-exists.

Lifecycle becomes `scheduled → preview → live → ended`, layered on the existing
encoder-first `preview → live → ended`. `scheduled` is, like `preview`, never
publicly live.

_Alternative considered:_ a dedicated table joined at stream time. Rejected — it
duplicates the metadata columns and forces a copy-into-`streams` step at claim time,
re-introducing the untitled-session problem this is meant to remove.

### The ingest hook *claims* the nearest upcoming scheduled row

`decideGoLive` gains a `claim-scheduled` branch. The ingest route now queries two
things: the channel's most-recent row (for the existing reconnect / stale logic) and
the **nearest claimable scheduled broadcast** — the `scheduled` row with the soonest
`scheduled_start_at` that has not expired. Precedence:

1. If the most-recent row is an ongoing-and-fresh `preview`/`live` session → reconnect
   (an active session always wins over a claim).
2. Else if a claimable scheduled row exists → **claim** it: update that row to
   `preview` (setting `hls_path`, `started_at`, `last_seen_at`), preserving its
   authored title/description/thumbnail.
3. Else fall through to the existing new / new-after-stale behavior.

Claiming keeps go-live manual: it only moves `scheduled → preview`; the public flip to
`live` is still `goLiveAction`. `decideGoLive` takes the candidate scheduled row as an
explicit input so it stays pure and unit-testable.

**Claimability / expiry.** A scheduled row is claimable while `scheduled_start_at` is
in the future OR within a grace window after it (`SCHEDULED_CLAIM_GRACE_MS`, default
~6h — covers a late start). Once start time is past by more than the grace window the
row is **missed**: not claimable, dropped from the coming-soon card, shown as "missed"
in the Broadcasts list. There is no lower bound on the future side — a far-future row
is claimable (per the owner's decision). "Missed" is a derived state from
`scheduled_start_at` vs now; it does not need its own status value. Following YouTube,
missed rows are not auto-deleted — the owner removes them manually (cancel sets the row
to `ended`).

### Coming-soon card is data-driven; offline placeholder stays as fallback

`ScheduledCard` becomes data-driven: given an upcoming scheduled broadcast it renders
thumbnail + title + countdown; with none it renders the existing static offline copy.
A new query returns the channel's nearest upcoming `scheduled` row (status
`scheduled`, `scheduled_start_at` in the future). The `channel-live` "offline
placeholder" requirement is modified to permit the countdown when scheduling data
exists. On go-live the live player replaces the card exactly as today.

## Risks / Trade-offs

- **[An abandoned `scheduled` row hijacks a fresh ad-hoc stream]** → Solved by expiry:
  once a scheduled row is past its start time by the grace window it is no longer
  claimable, so an unrelated later encoder-connect falls through to a normal new
  session instead of surfacing a stale title. The owner still deletes the missed row
  manually from the Broadcasts page (YouTube-aligned; cancel/delete sets it `ended`).
- **[Grace window too short or too long]** → Too short risks a genuinely-late start
  failing to claim its own broadcast; too long lets a long-dead row keep claiming.
  ~6h is a safe single-owner default; it is a single named constant, easy to tune.
- **[Clock skew on countdown]** → Countdown is cosmetic and client-rendered from
  `scheduled_start_at`; go-live is manual, so skew never starts a stream early.

## Migration Plan

1. Migration: add `scheduled_start_at timestamptz null` to `streams`; extend the
   status constraint to include `scheduled`. Regen `supabase/types.ts`.
2. Ship `decideGoLive` claim-scheduled branch + ingest update behind the existing
   ingest path (no flag needed — `scheduled` rows only exist once the UI creates
   them).
3. Ship Studio Broadcasts page + data-driven coming-soon card.

Rollback: no scheduled rows exist until the UI creates them, so reverting the UI
leaves the ingest claim branch inert; the column/constraint can remain.

## Open Questions

- Exact value of `SCHEDULED_CLAIM_GRACE_MS` — starting at ~6h; tune once there is real
  usage data on how late owners start relative to the scheduled time.
