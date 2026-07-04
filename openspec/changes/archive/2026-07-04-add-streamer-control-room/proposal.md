## Why

The studio configures overlays (`/studio/overlay`) and manages go-live (`/studio/live`),
but there is no surface to actually *run* a stream from: watch chat scroll, see which
messages the AI recommends reading out, and glance at goal/score state. The overlays are
for the audience; the owner needs their own window (ideally a second monitor). This change
adds that read surface. Moderation *actions* are a separate change (AZ-135); this builds
the inert button slots they will fill.

## What Changes

- **New owner-only route `/studio/control`** (`app/studio/control/page.tsx`),
  owner-guarded via `useRequireOwner()`, laid out dense/dark so it works popped into its
  own browser window. It resolves the current stream from `getOverlayContextAction`.
- **Live chat panel** — reuses `useLiveChat(streamId)` (realtime `chat_messages`),
  newest at the bottom, author handle + avatar.
- **"Read this" queue** — the AI-featured messages (`getFeaturedMessagesAction`), newest
  first, showing the message `body`, the AI's `reason`, and category tags, so the owner
  knows what to read out. Local "mark read" dismisses an item.
- **Glance bar** — scoring on/off + the top viewers (`useViewerLeaderboard`).
- **Moderation slots (inert)** — a Hide button per chat message and a Ban button per
  author, disabled with a "ships in AZ-135" affordance, so the layout is ready to wire.
- **Sidebar entry** "Control room" in `components/studio-sidebar.tsx`.

- **Out of scope**: the moderation engine/actions/DB (AZ-135); delegated mod roles
  (AZ-89); the public/OBS transparent chat overlay (AZ-131); persisting layout (AZ-136).

## Capabilities

### New Capabilities

- `streamer-control-room`: the owner-only live operations window (chat feed + AI
  read-this queue + glance bar + inert moderation slots).

## Impact

- **DB**: none (read-only; reuses existing tables and actions).
- **New files**: `app/studio/control/{page.tsx,page.hooks.tsx}`.
- **Changed**: `components/studio-sidebar.tsx` (one nav item).
- **Reuses**: `useOverlayContext`, `useLiveChat`, `useViewerLeaderboard`,
  `getFeaturedMessagesAction`, `useRequireOwner`, `channelAssetUrl`.
