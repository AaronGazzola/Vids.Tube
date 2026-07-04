## Why

The "No stream scheduled right now" empty-state box adds visual noise. After the
standalone live page (`extract-standalone-live-stream-page`) the scheduled/live
slot is only rendered for an actual scheduled/preview/live stream; when nothing is
on, the area should simply be empty rather than showing a static placeholder card.

## What Changes

- `components/scheduled-card.tsx`: the `ScheduledCard` empty branch (rendered when
  `broadcast` is null — the calendar icon + "No stream scheduled right now" copy)
  is removed; the component renders nothing when there is no broadcast. The
  coming-soon/countdown branch is unchanged.
- Slot render priority becomes: live → live player; else scheduled/preview →
  countdown card; else → nothing.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-broadcasts`: the "Coming-soon card" behavior no longer falls back to a
  static offline placeholder when there is no upcoming broadcast — it renders
  nothing.

## Impact

- `components/scheduled-card.tsx` only. No actions, hooks, routes, or DB changes.
- The empty branch is already effectively dead in the current UI (the sole caller,
  `LiveStreamView`, passes a non-null broadcast), so this is a safe cleanup.
