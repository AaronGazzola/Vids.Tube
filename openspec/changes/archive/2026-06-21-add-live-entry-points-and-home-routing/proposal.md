## Why

The standalone live-stream page (`/[channelSlug]/live`, added by
`extract-standalone-live-stream-page`) is currently unreachable: nothing in the
app links to it, and `/live` redirects to the channel page rather than the live
page. After that change the channel page shows only banner/avatar/grid, so a
viewer has no way to discover or open a live or upcoming stream. This change adds
the YouTube-style entry points and smart home routing so viewers can actually
reach the live experience.

## What Changes

- **Smart home routing**: the home page `/` redirects to the owner channel's
  live page `/[ownerSlug]/live` **only when** that channel's stream is `live`
  (status `live` with an `hls_path`). When the stream is scheduled/preview or
  there is no stream, `/` continues to render the channel page.
- **Featured live/upcoming card on the channel page**: when a channel has a
  `live` or `scheduled`/`preview` stream, the channel page renders a YouTube-style
  featured thumbnail card above the video grid that links to `/[channelSlug]/live`
  — a red **LIVE** badge when live, a **Scheduled/Upcoming** badge with date/time
  otherwise.
- **Live avatar ring**: when the channel is live, the channel avatar gets a red
  ring and becomes a link to `/[channelSlug]/live`; no ring or link otherwise.
- Scope is single-channel only; the multi-channel explore home (AZ-31) supersedes
  this later. This change does **not** include AZ-67's full "Live tab" bar or the
  past-stream replay-grid redesign — those remain AZ-67 follow-up work.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `channel-live`: the channel page is no longer banner/avatar/grid only — it adds
  a featured live/upcoming card and a live avatar ring linking to the live page;
  and the home page `/` redirects to the live page when (and only when) the owner
  channel is live, rather than never redirecting.

## Impact

- `app/page.tsx` — add live-only redirect to `/[ownerSlug]/live`.
- `components/channel-view.tsx` — featured live/upcoming card + live avatar ring
  linking to the live page; consume `useLiveStream` / `useUpcomingScheduled`.
- Reuses existing data paths (`getLiveStreamAction`,
  `getUpcomingScheduledBroadcastAction`) and styling building blocks
  (`fitted-thumbnail`, `scheduled-card`); no new actions, hooks, or DB changes.
- Reconciles with the unmerged `extract-standalone-live-stream-page` change, whose
  `channel-live` delta currently states the channel page shows only
  banner/avatar/grid and that `/` never redirects.
