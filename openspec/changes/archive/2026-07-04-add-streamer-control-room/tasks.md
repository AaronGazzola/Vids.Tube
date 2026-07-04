## 1. Read-this hook

- [x] 1.1 `app/studio/control/page.hooks.tsx`: `useReadThisQueue(streamId)` wrapping `getFeaturedMessagesAction` (`queryKey ["read-this", streamId]`, `enabled: !!streamId`, `refetchInterval: 8000`)

## 2. Control room page

- [x] 2.1 `app/studio/control/page.tsx` (`"use client"`): owner-guarded via `useRequireOwner()`; resolve stream via `useOverlayContext()`; full-page layout rendered immediately with inline skeletons for data
- [x] 2.2 Live/offline badge from `streamStatus`; header with channel slug
- [x] 2.3 Read-this panel: featured messages newest-first (`body`, `reason`, category tags, author avatar+handle); local dismissed-`Set` "mark read"
- [x] 2.4 Chat panel: `useLiveChat(streamId)`, newest at bottom, author handle + `channelAssetUrl(avatarPath)`; a disabled Hide per row (title: ships in AZ-135)
- [x] 2.5 Glance bar: scoring on/off from context + `useViewerLeaderboard(streamId)` top viewers, each with a disabled Ban (title: ships in AZ-135)

## 3. Navigation

- [x] 3.1 `components/studio-sidebar.tsx`: add `{ href: "/studio/control", label: "Control room", icon: <lucide> }`

## 4. Verification

- [x] 4.1 `npx tsc --noEmit`, `npx eslint app components` (0 errors), `npm run build:local` pass
- [x] 4.2 `openspec validate add-streamer-control-room --strict`

> Reconciliation (2026-07-04): removed 1 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
