## Why

The owner streams vertical video consumed mostly on phones through the YouTube app,
where YouTube's own mobile UI (top channel bar, overlaid live chat, chat input, reaction
button) covers parts of the video. Overlay layouts dialed in on the desktop preview can
collide with that mobile chrome. The Preview tab and the demo overlay stage need a way
to visualize exactly what a phone viewer sees so overlays are positioned around the
mobile UI, not under it.

## What Changes

- A **Mobile layout** switch that draws a representational YouTube-mobile chrome over
  the preview, matching the real app's scale, position, and opacity (reference: the
  owner's screenshot of a live vertical stream in the YouTube Android app):
  - Above the video: the channel top bar — back arrow, channel avatar, handle, live red
    dot with viewer count, like count, white Subscribe pill, three-dot menu.
  - On the lower video: overlaid live chat rows (avatars, member badges, handles,
    message text) and the "Welcome to live chat!…" notice line.
  - Straddling the bottom video edge: the "Chat…" input row, mostly below the video
    with a slight overlap, plus the circular heart reaction button at the bottom right.
- The switch is **all-or-nothing** (one toggle for the whole chrome, no per-element
  toggles) and is available in **both** the real Preview tab and the demo overlay
  stage; it can be turned off from either place.
- The on/off state persists per channel in the existing `demo_layouts.config` row and
  is shared by both modes.
- All chrome elements are representational only: static sample chat content and counts
  that look real (using the channel's actual handle and avatar in the top bar), no live
  data and no interactivity.

## Capabilities

### New Capabilities

- `mobile-layout-preview`: the Mobile layout switch, the representational mobile
  chrome, its anchoring to the video rect in the real Preview tab and the demo stage,
  and the persisted shared toggle state.

## Non-goals / Related

- No mobile chrome in the pop-out preview window (`/popout/[slug]?panel=preview`) —
  the switch lives on the `/live` page only.
- No per-element visibility toggles (decided all-or-nothing).
- No simulation of YouTube chat behavior — the chrome is a static visual reference.

## Impact

- `app/(app)/live/demo.types.ts`, `demo.stores.ts`: `mobileChrome: boolean` added to
  `DemoLayoutConfig` (default false) with a store setter; no DB migration (the field
  rides in the existing `demo_layouts.config` jsonb).
- `app/(app)/live/page.tsx`: always-on layout hydration; Mobile layout chip on the
  real preview; chrome props passed to the player.
- `components/live-player.tsx`: shrink-wrapped video with optional mobile chrome and
  portrait detection.
- New `components/mobile-chrome.tsx`: the chrome elements and reference geometry.
- `app/(app)/live/demo-preview.tsx`: phone anchor box, scaled stream wrapper, chrome,
  and a Mobile layout row in the overlay control panel.
- Depends on `add-live-demo-mode` (the demo stage, layout store, and persistence it
  extends) — that change must be archived first.
