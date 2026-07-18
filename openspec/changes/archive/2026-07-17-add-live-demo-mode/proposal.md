## Why

The owner needs to rehearse a broadcast — see the overlays sitting over real footage,
watch chat/scoring/competition fill in, and dial in the overlay layout — without going
live, running the worker, or touching real data. The old `/studio/demo` page that did
this is gone (studio was removed), leaving the `overlay-demo` / `overlay-demo-sim` specs
orphaned. This change folds a self-contained demo into the unified `/live` page as a
**Demo switch**, so the same page toggles between managing the real stream and
previewing a simulated one.

The demo is a **view layer only**: it renders the real overlay and activity components
driven by a client-side generator. It makes no writes to stream/chat/scoring tables and
never involves the worker or YouTube, so toggling it on and off is non-destructive — the
real active stream (and any settings the owner saves) is untouched and reappears exactly
as saved when the switch is turned off.

## What Changes

- **Demo switch** in the `/live` tab bar (far right). Off by default. On → the page's
  Preview and Activity tabs switch to a simulated stream; off → the real active stream
  returns. The Settings tab always edits/saves the real stream in both modes, so the
  owner can prep their broadcast while previewing.
- **Per-tab pop-out**: the pop-out icon shows only on the Preview and Activity tabs and
  pops out **that tab's** content (Preview player / Activity panel); it is not shown on
  Settings.
- **Demo preview** replaces the player with a slideshow of frames from the channel's
  published VODs (`videos.preview_paths` + thumbnails). Autoplay cycles the frames;
  prev/next step manually; picking a frame pauses autoplay and holds it.
- **Demo overlays over the player**: all overlays render over the slideshow — the three
  goal bars, competition, highlighted-message, and avatar bubbles. Goals and competition
  are draggable + resizable boxes; highlight and avatars play as full-stage animations.
  Each overlay has a **show/hide toggle**, plus a **goal-progress toggle** (in-progress
  vs reached) and a reset-layout control.
- **Persisted demo layout**: overlay positions/scales, per-overlay visibility, the
  goal-progress state, and background choice persist per channel and are restored the
  next time demo is enabled.
- **Demo activity**: the Activity tab renders simulated chat, scoring/competition, and
  mod actions with the same presentational components as live, driven by the generator.
- **Toolbar in demo** shows a Demo indicator; Go live / End / Discard are hidden (no
  lifecycle action applies to a simulated stream); Save changes (real Settings) remains.

## Capabilities

### New Capabilities

- `live-demo-mode`: the Demo switch on `/live`, the per-tab pop-out, the VOD-frame
  slideshow preview, the repositionable/toggleable overlay stage with saved layout, the
  simulated activity, and the demo toolbar state.

## Non-goals / Related

- This does not validate AI scoring **decisions** — the demo simulates the overlays'
  *outputs*, not the model's judgement (a live run still verifies that).
- The orphaned `overlay-demo` / `overlay-demo-sim` specs (the deleted `/studio/demo`
  page) are superseded by this capability; removing those stale specs is left as a
  separate cleanup.

## Impact

- New `demo_layouts` table (migration + push + types): `channel_id` PK, `config` jsonb,
  `updated_at`.
- `app/(app)/live/page.tsx`: add the Demo switch + per-tab pop-out to the tab bar; route
  Preview/Activity through demo variants when demo is on; adjust the toolbar.
- New `app/(app)/live/demo.stores.ts` (generator + layout state), `demo.hooks.tsx`
  (load/save layout, frames), `demo.actions.ts` (`getDemoFramesAction`,
  `getDemoLayoutAction`, `saveDemoLayoutAction`), and a demo preview stage + demo
  activity view reusing the presentational components from `panels.tsx` and the overlay
  components in `components/overlay/`.
- Depends on `unify-live-stream-page` (the `/live` page, tabs, toolbar, and the
  `ActivityContent` presentational components).
