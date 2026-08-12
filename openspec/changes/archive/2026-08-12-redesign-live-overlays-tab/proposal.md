## Why

The Preview tab carries three unrelated jobs at once: the private encoder preview, the demo
stage, and the overlay layout editor. Which one is showing depends on a global Demo switch in
the page header and an "Edit overlays" button floating over the video, so laying out overlays
means turning on a switch that also replaces the Activity tab, and checking the encoder feed
means turning it off again. The overlay layout work also cannot be done against real values at
all: the editor draws ghost outlines over the demo stage, so what is positioned is never what
viewers see.

Splitting the two jobs into two tabs lets each be the default state of its own page, removes
the modal switch and the floating button, and lets overlays be positioned against their real
current values instead of ghosts.

## What Changes

- **BREAKING** The global Demo switch is removed from the /live page header. Demo becomes a
  control on the new Overlays tab, and the Activity tab gains its own separate demo toggle.
- The Preview tab keeps only the private preview player, the transcript panel, and the mobile
  layout toggle. The demo stage, the overlay editor and the "Edit overlays" button are removed
  from it.
- A new Overlays tab is added between Preview and Activity, carrying:
  - the still-frame slideshow, gradient and black background choices, as today;
  - every visible overlay rendering its real current values, shown genuinely empty when no
    broadcast is live;
  - the overlay control panel and its collapse button as the default state, rather than
    something the Demo switch reveals;
  - a global Demo switch and a global goal-reached switch;
  - a checkbox choosing whether demo values also reach OBS, or stay in the web app only;
  - a mobile layout switch;
  - a switch showing or hiding the resize and reposition containers for every overlay.
- Overlay containers are hidden and immovable while the resize switch is off. While it is on,
  every overlay shows a clearly visible container with four corner grab handles.
- Corner handles drive the existing uniform scale value, anchored to the opposite corner, so
  aspect ratio is preserved by construction and content is never stretched.
- Bitmap content inside overlays, such as chatter avatars, is requested at a resolution
  matched to the overlay's scale, so enlarging an overlay never shows a soft image.
- Choosing to show demo in OBS while a broadcast is live warns clearly and is still allowed.
- Demo values already reach OBS unconditionally over a realtime broadcast channel, which the
  overlay route treats as an override with a staleness timeout. The new checkbox gates that
  existing push rather than adding a path: unchecked, nothing is broadcast and OBS keeps
  showing real values while the web app shows demo.
- The goal-reached state is expressed as demo metrics at or above their targets inside that
  same snapshot, so it needs no new transport either.

## Capabilities

### New Capabilities
- `live-overlays-tab`: the Overlays tab as a place to compose overlays against real values,
  covering the tab itself, the real-value render and its empty state, the control panel as
  default state, the resize/reposition mode with corner handles and aspect-preserving scale,
  and resolution-matched bitmap content.

### Modified Capabilities
- `live-demo-mode`: the demo switch moves off the page header onto the Overlays tab, gains a
  goal-reached companion and an OBS-scope checkbox, and no longer governs the Activity tab,
  which gets its own toggle. The demo stage stops being a Preview tab concern.
- `streamer-control-room`: the tab set gains Overlays, and overlay preview is bound to real
  data by default rather than to test data.

## Impact

- `app/(app)/live/page.tsx`: tab list, the removed header Demo switch, and the reduced Preview
  tab content.
- `app/(app)/live/demo-preview.tsx`: the stage moves to the Overlays tab and renders real
  values, with demo values behind the new switch.
- `app/(app)/live/overlay-editor.tsx`: the ghost-outline editor is replaced by containers
  drawn around the real overlays, with four corner handles instead of one.
- `app/(app)/live/demo.stores.ts` and `demo.types.ts`: the toolbar state gains the demo,
  goal-reached, OBS-scope and resize-mode flags. Only the resize-mode default and any new
  persisted field touch the saved layout, so the layout version bump must preserve positions.
- `app/(overlay)/overlay/[channelSlug]/`: unchanged in behaviour. The route already treats a
  demo snapshot as an override, so gating the sender is enough.
- `app/(app)/live/demo-activity.tsx`: driven by the Activity tab's own toggle.
- Existing saved layouts must survive the version bump without losing positions.
