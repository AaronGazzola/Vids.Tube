## 1. Remove the empty-state branch

- [x] 1.1 In `components/scheduled-card.tsx`, change `ScheduledCard` so that when `broadcast` is null/undefined it returns `null` (remove the calendar-icon + "No stream scheduled right now" markup); keep the `ComingSoonCard` branch for a present broadcast
- [x] 1.2 Remove any imports left unused by the deletion (e.g. `CalendarClock` if no longer referenced)

## 2. Verification

- [x] 2.1 `npx tsc --noEmit` and `npx eslint components/scheduled-card.tsx` pass
- [x] 2.2 Grep confirms no "No stream scheduled right now" string remains in the codebase
