## Why

Owner stream operations are split across `/go-live` (connection, preview, go-live,
end) and `/control` (overlay setup, overlay preview, chat/AI/leaderboard/moderation
panels). The owner wants **one** state-driven page. The root `/live` route is dead
(a redirect referenced only by the orphaned `LiveBanner`; the public watch surface is
`/[channelSlug]/live`), so it can be reclaimed for the unified owner page. This change
builds `/live` as the single stream-management surface over the new lifecycle, and
removes `/go-live` and `/control`.

## What Changes

- **Reclaim `/live`** for an owner-only management page targeting the single active
  stream (`stream-lifecycle`), state-driven across `draft`/`scheduled`/`preview`/`live`.
  Delete the dead `app/live/page.tsx` redirect and the orphaned
  `components/live-banner.tsx`.
- **Three tabs + a fixed status toolbar** (toolbar visible on all tabs):
  - **Settings tab**:
    - Broadcast details: title, description, thumbnail, and a schedule datetime
      (disabled once the stream is public/live).
    - Connection: get/set the stream key + RTMP URL + regenerate.
    - YouTube: the YouTube stream URL input.
    - Goals: targets for subs, likes, viewers. **Subs** tracks a delta from a
      baseline that auto-sets when the stream is scheduled, or at go-live if not
      scheduled. **Likes** and **viewers** are absolute values fed from YouTube (no
      start time / baseline).
    - Overlays: copy URL + OBS dimensions for **Highlights**, **Goal subs**,
      **Goal likes**, **Goal viewers**, and **Competition**, plus a competition
      opacity control.
    - Mod bot: auto-hide is always on (shown as fixed); a switch for ban mode
      (auto-ban vs suggest); a switch for chat scoring on/off; a switch for
      featured-message highlighting on/off; and a switch to auto-display featured
      messages in the highlight overlay (disabled when highlighting is off).
    - Waiting-room chat toggle (from `add-waiting-room-chat`).
    - Worker reminder: the copy-paste command to start the local worker, plus a
      running/stopped indicator from the heartbeat.
  - **Preview tab**: the video player (private preview HLS in `preview`, public HLS in
    `live`) and, below it, the live transcription in an auto-scrolling component
    (populates only while `live`).
  - **Activity tab**: a compact header with all three goal progresses (subs, likes,
    viewers) and a collapsible competition (collapsed = top 3 + points; expanded =
    full leaderboard; no ban controls); the live chat; and the mod bot actions
    component. The whole Activity tab can pop out into its own window.
    - Live chat message affordances: a three-dot menu (hide message, ban user);
      hidden messages (by owner or bot) collapse to a thin row that opens a popover
      with Reveal, and when revealed show hidden styling plus Hide (recollapse) and
      Unhide (share back to public); a bot-suggested-feature message has prominent
      highlight styling with Highlight and Dismiss buttons, dropping to a secondary
      (less prominent, still distinct) styling once highlighted or dismissed; a scored
      message shows a score badge whose click opens a popover with the bot's reasoning.
    - Mod bot actions component: collapsible, collapsed by default, with Hidden and
      Banned tabs each showing a counter; expanded, it lists suggested and
      auto-enacted cases with the original message and reasoning plus Unhide/Unban.
  - **Status toolbar** (fixed, all tabs): stream status on the left; a red Go
    live / End stream button next to it (disabled unless `preview` or `live`); the
    view count when `live` or the waiting count when `scheduled`; a Save changes
    button on the right (disabled when the form state equals the DB). Discard is
    available in `draft`/`scheduled`/`preview`. Go live, End stream, and Discard each
    require a confirmation dialog.
- **Remove `/go-live` and `/control`**; migrate their functionality into `/live`.
  Repoint the pop-out page's imports (it imports from `control/`).
- **Sidebar** shows only **Account** and **Go Live** (→ `/live`).

## Capabilities

### New Capabilities

- `live-stream-management`: the unified owner `/live` page — its state model, the
  Settings/Preview/Activity tabs, every control listed above, and the status toolbar.

### Modified Capabilities

- `app-shell`: owner-gated navigation is the sidebar with Account + Go Live (→ `/live`).
- `streamer-control-room`: the operations hub is now the `/live` Activity/Settings
  tabs; `/control` and `/go-live` are removed.
- `broadcast-setup`: adds Discard and confirmation dialogs for Go live / End / Discard,
  driven from the status toolbar.
- `overlay-control`: overlay URLs are copyable without an active stream; the overlay
  content settings and mod bot switches live in the `/live` Settings tab.

## Impact

- New `app/(app)/live/` page + its hooks/actions (recomposing existing go-live +
  control + overlay hooks/actions, which already exist).
- Delete `app/(app)/go-live/`, `app/(app)/control/`, `app/live/page.tsx`,
  `components/live-banner.tsx`; relocate the shared `overlay.*` used by the pop-out
  page; update pop-out imports.
- `components/app-sidebar.tsx`: Account + Go Live only.
- Depends on `redesign-stream-lifecycle` (states, discard, `live_at`),
  `run-worker-through-prelive` (heartbeat for the reminder), and
  `add-waiting-room-chat` (waiting-room toggle + validation dialogs).
