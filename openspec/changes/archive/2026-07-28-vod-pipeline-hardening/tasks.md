## 1. Reaper

- [x] 1.1 `lib/broadcast-end.ts`: `reapStaleProcessingVods(channelId)` —
  for each `processing` video on the channel whose source stream is `ended`
  more than 60 minutes ago: publish (`ready` + `published_at`) when
  `mp4_path` exists, else mark `failed`; log each action.
- [x] 1.2 Call it from `app/api/ingest/live/route.ts` (heartbeat path) and
  from the owner's current-broadcast action in
  `app/(app)/live/broadcast.actions.ts`.

## 2. Matching

- [x] 2.1 `app/api/ingest/recording/route.ts` `findTargetVideo`: legacy
  fallback returns a row only when it is the channel's sole `processing`
  row; otherwise log and return null (404 keeps the recording on the VM).

## 3. Preview inheritance

- [x] 3.1 `app/api/ingest/live/route.ts` "new" branch: when the channel's
  latest `ended` stream ended within 10 minutes, copy its
  title/description/thumbnail_path onto the new preview row and log a
  distinct tag.

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
- [x] 4.2 Programmatic check against prod: no `processing` rows older than
  the reap window remain after invoking the reaper.
