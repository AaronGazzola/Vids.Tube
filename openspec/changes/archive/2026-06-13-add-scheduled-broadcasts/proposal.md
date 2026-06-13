## Why

Today a broadcast only exists once the encoder connects: the ingest `live` hook
inserts a fresh `streams` row in `preview`, and only then can the owner author its
title/description/thumbnail (the broadcast-setup flow, AZ-53). There is no way to
set up a stream ahead of time or tell viewers one is coming — the channel page shows
a static "No stream scheduled right now" placeholder regardless. This change adds the
scheduling layer on top of the existing preview→Go-live flow (AZ-28).

## What Changes

- Add a `scheduled_start_at` (timestamptz, nullable) column and a new `scheduled`
  value to the `streams` status lifecycle: `scheduled → preview → live → ended`
  (alongside the existing encoder-first `preview → live → ended` path).
- New Studio **Broadcasts** page (`/studio/broadcasts`): list the channel's upcoming
  and past broadcasts, and create / edit / cancel a scheduled broadcast (title,
  description, thumbnail, start time) ahead of time. Thumbnail upload reuses the
  existing R2 path from broadcast-setup.
- **BREAKING (ingest attach behavior):** when the encoder connects and the channel has
  a claimable scheduled broadcast — the **nearest upcoming** `scheduled` row that has
  not expired (see below) — the ingest `live` hook **claims** that row into `preview`
  (carrying its authored title/description/thumbnail) instead of inserting a brand-new
  untitled `preview` row. An active (reconnect) session still takes precedence over a
  claim. The owner then clicks **Go live** per the existing AZ-53 gate. Go-live remains
  **manual** — the schedule never auto-starts.
- Replace the static `ScheduledCard` placeholder on the channel page with a real
  **coming-soon card** (thumbnail + title + countdown to start) when an upcoming
  scheduled broadcast exists; fall back to the existing idle placeholder otherwise. On
  go-live the live stream replaces the coming-soon card as it does today.
- A scheduled broadcast whose start time has passed by more than a grace window
  without being claimed becomes **missed**: it is no longer claimable (so it cannot
  hijack a later ad-hoc stream), it drops off the coming-soon card, and it is shown as
  "missed" in the Broadcasts list. Following YouTube, missed broadcasts are **not**
  auto-deleted — the owner deletes (or cancels) them manually. A missed broadcast
  produces no VOD.

## Capabilities

### New Capabilities

- `scheduled-broadcasts`: owner-facing create-ahead authoring of a future broadcast
  (title/description/thumbnail/start time), the Studio Broadcasts list (upcoming +
  past) with create/edit/cancel, and the public coming-soon countdown card on the
  channel page.

### Modified Capabilities

- `stream-pipeline`: the ingest `live` hook claims a `scheduled` row into `preview`
  (preserving its authored metadata) rather than always inserting a new row; the
  status lifecycle gains the `scheduled` value that precedes `preview`.
- `studio`: the Studio shell gains a **Broadcasts** entry/tool alongside Go Live.
- `channel-live`: the channel page renders an upcoming scheduled broadcast as a
  coming-soon card (and treats only `live` as publicly live, unchanged).

## Impact

- **Schema/migration:** `streams` gains `scheduled_start_at`; add `scheduled` to the
  status check/lifecycle; regen `supabase/types.ts`.
- **Ingest:** `lib/stream.ts` (`decideGoLive` gains a `claim-scheduled` branch) and
  `app/api/ingest/live/route.ts` (claim the scheduled row → `preview` instead of
  insert).
- **Actions/hooks:** new `app/studio/broadcasts/page.actions.ts` (list/create/update/
  cancel scheduled broadcasts; reuse `uploadBroadcastThumbnailAction`'s R2 helper) and
  `page.hooks.tsx`; a query for the channel's upcoming scheduled broadcast feeding the
  channel page.
- **UI:** new `app/studio/broadcasts/page.tsx`; Studio sidebar entry; rework
  `components/scheduled-card.tsx` into a data-driven coming-soon card; wire it in
  `components/channel-view.tsx`.
- **Tests:** unit (`decideGoLive` claim-scheduled branch) and e2e (create a scheduled
  broadcast → coming-soon card shows with countdown → encoder connect claims it into
  preview with metadata intact → Go live shows the live stream).
- **Out of scope:** reminders / "notify me" / push / email (AZ-29); auto-go-live at
  scheduled time; privacy/visibility tiers (deferred).
- **Related Linear:** AZ-28 (this change); depends on completed AZ-53; AZ-29 owns
  notifications.
