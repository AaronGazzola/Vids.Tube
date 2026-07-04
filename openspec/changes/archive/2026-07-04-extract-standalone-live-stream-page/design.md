## Context

The live experience is currently embedded in `components/channel-view.tsx`. In its
`<section className="mt-8">` block it branches on
`isLive = stream?.status === "live" && !!stream.hls_path`:
- live → a `lg:grid-cols-[1fr_340px]` layout with `LiveStage` + title +
  `CollapsibleDescription` on the left and `LiveChat` on the right;
- not live → `ScheduledCard` (which renders `ComingSoonCard` when an upcoming
  broadcast exists, else a static empty card).

The data comes from `useLiveStream(channel.id)` (`getLiveStreamAction`) and
`useUpcomingScheduled(channel.id)` (`getUpcomingScheduledBroadcastAction`, which
already returns connected `preview` rows and upcoming `scheduled` rows). Chat is
`LiveChat({ streamId })`, where `streamId` is currently only set when live.

`/` (`app/page.tsx`) renders `ChannelView` for the owner channel, so any change to
the channel view's live section also changes the root home.

## Goals / Non-Goals

**Goals:**
- A standalone `/[channelSlug]/live` page that owns scheduled/preview/live watch.
- Pre-stream chat in the scheduled/preview states.
- Channel page (`/[channelSlug]`) reduced to header + video grid.

**Non-Goals:**
- No new "preview player" — preview reuses the coming-soon countdown.
- No channel-page tab redesign or home routing changes (AZ-67).
- No DB/RLS/migration changes; no changes to `LiveStage`, `LiveChat`,
  `ScheduledCard`, or the existing actions/hooks.
- No navigation affordance from the channel page to the live page (deferred to
  AZ-67); the live page is reachable by direct URL for now.

## Decisions

- **New `LiveStreamView` client component + thin route.** Add
  `components/live-stream-view.tsx` (`"use client"`, takes `{ slug }`) that holds
  exactly the live/scheduled rendering lifted from `channel-view.tsx`, and
  `app/[channelSlug]/live/page.tsx` that reads `useParams<{ channelSlug }>()` and
  renders `<LiveStreamView slug={...} />` — mirroring the existing
  `app/[channelSlug]/page.tsx` → `ChannelView` pattern. This keeps the data
  hooks (`useChannel`, `useLiveStream`, `useUpcomingScheduled`) client-side and
  reuses the established query keys/refetch intervals.
  - Alternative considered: a server component doing the redirect server-side —
    rejected because the channel/stream data is already fetched via client React
    Query hooks with polling (`refetchInterval`), and the live/scheduled state
    must update live without a full navigation.

- **State selection mirrors the current `isLive` logic.** `LiveStreamView`
  computes `isLive = stream?.status === "live" && !!stream.hls_path` and
  `upcoming = useUpcomingScheduled(...)`. Render: live → `LiveStage` + title +
  `CollapsibleDescription` + `LiveChat`; otherwise if `upcoming` exists →
  `ScheduledCard` (countdown) + `LiveChat`; otherwise redirect.

- **Chat is present in every rendered state.** `LiveChat` takes a `streamId`.
  - Live: `streamId = stream.id`.
  - Scheduled/preview: `streamId = upcoming.id` (the scheduled/preview row). This
    is the change that enables pre-stream chat. `LiveChat`/`usePostChatMessage`
    already post against whatever `streamId` they are given, and the
    `chat_messages` RLS insert policy only checks `user_id = auth.uid()` — not
    stream status — so posting against a scheduled/preview row already works with
    no DB change.
  - The page reuses the same `lg:grid-cols-[1fr_340px]` two-column layout in all
    states so chat sits beside the player/countdown consistently.

- **No-stream → redirect to the channel page.** When not live and `upcoming` is
  null (and channel data has settled), redirect to `/[channelSlug]` via
  `router.replace`. While channel/stream queries are still pending, render the
  existing loading skeletons rather than redirecting, to avoid a redirect flash
  on first paint. An unknown slug also redirects to `/[channelSlug]`, whose
  `ChannelView` already renders the not-found state.

- **Channel page strips the live section.** Remove the entire
  `<section className="mt-8">…</section>` live/scheduled block from
  `channel-view.tsx`, plus the now-unused `isLive`/`streamId` locals and the
  imports/hooks that become dead (`useLiveStream`, `useUpcomingScheduled`,
  `LiveStage`, `LiveChat`, `ScheduledCard`, `CollapsibleDescription`). The header,
  branding dialogs, and `Videos` section are unchanged. Because `/` renders
  `ChannelView`, the root home loses inline live as a direct consequence — this is
  intended and reflected in the `channel-live` spec delta.

## Risks / Trade-offs

- [No path from the channel page to `/[channelSlug]/live` after the section is
  removed] → Accepted and intended: discoverability/navigation is AZ-67's scope;
  for this change the live page is reachable by direct URL. Called out so the gap
  reads as deliberate, not an omission.
- [Redirect flash if the redirect fires before queries settle] → Mitigated by
  gating the redirect on non-pending channel/stream queries and showing skeletons
  while pending.
- [`ScheduledCard`'s static empty-state branch becomes unreachable on the live
  page (we redirect instead of showing it)] → Acceptable; the empty card is still
  referenced elsewhere and its removal is tracked separately (AZ-66). This change
  does not delete it.
