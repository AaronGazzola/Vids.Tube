## 1. Data model

- [x] 1.1 Migration `add_clip_markers`: table per design.md, owner-only select
  RLS, `clip` seed (cooldown 60, sort_order 33)
- [x] 1.2 Push + regen types

## 2. Worker

- [x] 2.1 `worker/lib/clip-command.ts`: `clipHandler` (stream-time from
  live_at/started_at, last-3-segments snippet, marker insert, formatted ack
  mentioning a possible YouTube short); register `clip` in `BUILTIN_HANDLERS`

## 3. Owner panel

- [x] 3.1 `getClipMarkersAction(streamId | null)` (owner; null -> latest ended
  stream) + `useClipMarkers` hook (10s poll)
- [x] 3.2 `panels.tsx`: "Clip markers" collapsible panel (timestamp h:mm:ss,
  requester with origin badge, snippet) rendered in ActivityContent; the
  Activity tab's no-broadcast state also renders the panel (streamId null) so
  the shortlist shows post-stream

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 4.2 `scripts/verify-clip.ts` (guarded): seed scheduled stream + scoring +
  transcript; run worker; `!clip` -> marker row with plausible stream_time_s,
  snippet containing the transcript text, and an executed event whose reply
  mentions the recorded clip/short; cleanup
- [x] 4.3 e2e (`tests/e2e/clip.spec.ts`): seed an ended stream with a marker
  (no active stream) -> owner Activity tab shows the Clip markers panel with
  the timestamp, requester, and snippet
- [x] 4.4 `npx openspec validate add-clip-command --strict`
