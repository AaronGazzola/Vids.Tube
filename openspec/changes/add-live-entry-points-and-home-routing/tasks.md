## 1. Smart home routing (live-only)

- [x] 1.1 In `app/page.tsx`, add `useLiveStream(channel?.id)` (from `app/layout.hooks`) alongside the existing `useOwnerChannel()` call
- [x] 1.2 Compute `isLive = stream?.status === "live" && !!stream.hls_path`; when the owner channel and its stream query have settled and `isLive`, `router.replace(\`/${channel.slug}/live\`)` inside a `useEffect` (use `next/navigation` `useRouter`)
- [x] 1.3 Keep the existing pending skeleton and do not redirect while `useOwnerChannel`/`useLiveStream` are pending, so the channel page never flashes before the redirect decision

## 2. Featured live/upcoming card on the channel page

- [x] 2.1 In `components/channel-view.tsx`, add `useLiveStream(channel?.id)` and `useUpcomingScheduled(channel?.id)` (from `app/layout.hooks` and `app/[channelSlug]/page.hooks`) to drive entry points only (no embedded player)
- [x] 2.2 Compute `isLive = stream?.status === "live" && !!stream.hls_path` and `upcoming = upcomingScheduled ?? null`; the featured card renders when `isLive || !!upcoming`, with `isLive` taking precedence
- [x] 2.3 Render a featured card above the `Videos` `<section>` linking (`next/link`) to `/${channel.slug}/live`: reuse the thumbnail rendering (`FittedThumbnail` / `vodAssetUrl(stream.thumbnail_path)`) and a `Badge` (`components/ui/badge`) showing a red `LIVE` badge when live, or a `Scheduled`/`Upcoming` badge plus the broadcast date/time (from `scheduled_start_at`) when scheduled/preview
- [x] 2.4 If the card markup is non-trivial, extract it to `components/live-feature-card.tsx` taking `{ slug, stream, isLive }`; otherwise keep it inline in `channel-view.tsx`

## 3. Live avatar ring

- [x] 3.1 In `components/channel-view.tsx`, when `isLive`, add a red ring to the existing `Avatar` (Tailwind `ring`/`ring-destructive` classes via `cn`) and wrap the avatar in a `next/link` to `/${channel.slug}/live`
- [x] 3.2 When not live, render the avatar with no ring and no link (preserve the current owner upload button behavior in both states)

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` and `npx eslint` pass for `app/page.tsx`, `components/channel-view.tsx`, and any new `components/live-feature-card.tsx`
- [ ] 4.2 Manually confirm (deferred — needs Doppler env, tracked as a Linear verification issue): `/` redirects to `/[ownerSlug]/live` only when live; the channel page shows the featured card for live and scheduled/preview linking to the live page; the avatar shows a red ring and links to the live page only when live; nothing redirects or flashes while loading
