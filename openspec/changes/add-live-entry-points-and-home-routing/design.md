## Context

`extract-standalone-live-stream-page` moved the live/scheduled/preview watch
experience to `/[channelSlug]/live` and reduced the channel page to
banner/avatar/grid. As a result the live page has no entry point: `/live`
redirects to the channel page, and the channel page exposes no live affordance.
This change adds the discovery/navigation surfaces, single-channel only.

The owner channel is the home page (`app/page.tsx` renders `ChannelView` for the
owner channel). The same `channel-view.tsx` renders both `/` and `/[channelSlug]`.
Stream state is available client-side via `useLiveStream(channelId)` (most-recent
stream row, `live` when `status === "live" && hls_path`) and
`useUpcomingScheduled(channelId)` (connected preview prioritized, else next
scheduled), both already used by `LiveStreamView`.

## Goals / Non-Goals

**Goals:**
- Make `/[channelSlug]/live` reachable through YouTube-style affordances.
- Home `/` surfaces the stream by redirecting to the live page only when live.
- Channel page shows a featured live/upcoming card and a live avatar ring.

**Non-Goals:**
- The full AZ-67 "Live tab" bar and past-stream replay-grid redesign.
- Multi-channel explore home (AZ-31).
- Any change to the live page itself, chat, actions, hooks, or DB schema.
- Redirecting `/` for scheduled/preview state (explicitly live-only).

## Decisions

- **Home redirect lives in `app/page.tsx`, client-side, live-only.** `HomePage`
  already resolves the owner channel via `useOwnerChannel`. Add
  `useLiveStream(channel?.id)`; when settled and `status === "live" && hls_path`,
  `router.replace(\`/${channel.slug}/live\`)`. Do not redirect while pending —
  keep the existing skeleton. Rationale: mirrors the existing client redirect
  pattern in `LiveStreamView`; avoids a server round-trip and keeps a single
  data path. Alternative (server redirect in a server component) was rejected to
  avoid duplicating stream-staleness logic and to reuse the existing hooks.
- **Featured card and avatar ring live in `components/channel-view.tsx`.** That
  component renders both `/` and `/[channelSlug]`, so both entry points appear
  wherever the channel page shows. It gains `useLiveStream` + `useUpcomingScheduled`
  (the calls removed from it during the AZ-65 extraction return here, but only to
  drive affordances — not to embed the player). The featured card sits above the
  `Videos` section and links to `/[channelSlug]/live`.
- **Reuse existing presentation.** The card reuses the thumbnail rendering used
  by `fitted-thumbnail`/`scheduled-card` and a `Badge` for LIVE/Scheduled. The
  avatar ring is a Tailwind `ring` on the existing `Avatar`, wrapped in a
  `next/link` only when live. No new shared components unless the card markup is
  non-trivial, in which case a small `live-feature-card.tsx` may be extracted.
- **State precedence:** live takes precedence over scheduled/preview for both the
  card badge and the avatar ring, matching `LiveStreamView`'s `isLive` rule.

## Risks / Trade-offs

- [Channel page now issues two extra queries (`useLiveStream`,
  `useUpcomingScheduled`) on every channel view] → Both are already used elsewhere
  and cheap; `useLiveStream` polls at 15s as today. Acceptable for single-channel.
- [Redirect flicker on `/` could flash the channel page before redirecting] → Gate
  on settled state and keep the skeleton during pending so no channel content
  renders before the redirect decision, matching `LiveStreamView`.
- [Spec divergence from `extract-standalone-live-stream-page`] → This change ships
  on the same branch and its `channel-live` delta explicitly supersedes the
  "banner/avatar/grid only" and "never redirect" statements; reviewers see both
  deltas together.
