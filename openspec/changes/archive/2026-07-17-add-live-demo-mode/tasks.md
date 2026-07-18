## 1. Persistence

- [x] 1.1 Migration `demo_layouts` (channel_id PK → channels, config jsonb default '{}',
  updated_at) with RLS + owner read policy; `supabase/types.ts` updated for the new table
- [x] 1.2 Push the migration to the remote DB (`npx supabase db push`) — owner-authorized
  deploy step (blocked by the auto-mode classifier until the owner runs/allows it)
- [x] 1.3 `app/(app)/live/demo.actions.ts`: `getDemoLayoutAction()` (owner-checked read),
  `saveDemoLayoutAction(config)` (owner-checked upsert), `getDemoFramesAction()` (owner
  read of the channel's `status='ready'` videos → ordered frame URLs from
  `preview_paths`/`thumbnail_path` via `NEXT_PUBLIC_VOD_BASE_URL`)

## 2. Demo state

- [x] 2.1 `app/(app)/live/demo.types.ts` + `demo.stores.ts`: layout store (overlay boxes
  {x,y,scale} + per-overlay visibility, goalProgressFull, background) + generator store
  (roster, chat feed, scores, featured, mod actions, goal counts) with local mutators
- [x] 2.2 `app/(app)/live/demo.hooks.tsx`: `useDemoLayout` (hydrate from
  `getDemoLayoutAction`, debounced save via `saveDemoLayoutAction`), `useDemoFrames`
  (`getDemoFramesAction`), `useDemoController` (timer advancing the generator: a message
  ~every 1.6s, subset scored, a few featured, leaderboard + goal ticks)

## 3. Tab bar: demo switch + per-tab pop-out

- [x] 3.1 In `app/(app)/live/page.tsx` add a `demo` boolean (ephemeral, default off) and a
  shadcn `Switch` on the far right of the tab bar labelled Demo (enabling switches to
  Preview)
- [x] 3.2 Show the pop-out icon only when the active tab is Preview or Activity, popping
  that tab's content; Preview uses `/popout/[slug]?panel=preview`, Activity keeps
  `?panel=all`; hide pop-out while demo is on; no pop-out on Settings
- [x] 3.3 Add `panel=preview` mode to `app/(overlay)/popout/[channelSlug]/page.tsx`
  rendering the preview player

## 4. Demo preview stage

- [x] 4.1 `demo-preview.tsx` slideshow over the player area: autoplay interval, prev/next
  step, play/pause (manual step pauses autoplay); empty state when no frames
- [x] 4.2 Overlay stage laying surfaces over the slideshow: goal bars (subs/likes/viewers)
  + competition (avatar-bubble field) as draggable/resizable boxes; highlight as a
  full-stage animation
- [x] 4.3 Stage controls: show/hide toggle per overlay, goal-progress toggle
  (in-progress/reached), background toggle (slideshow/gradient/black), reset layout — all
  wired to the layout store and persisted
- [x] 4.4 Render the demo preview stage in the Preview tab when demo is on (real
  player/transcript when off)

## 5. Demo activity

- [x] 5.1 `demo-activity.tsx` rendering the header (goal bars + competition), mod bot
  actions, and chat with the same affordances as live (3-dot menu highlight/hide/ban with
  confirm + hide-past checkbox, suggested highlight/dismiss/info popover, hidden
  reveal/unhide, score badge popover), driven by the generator store
- [x] 5.2 Render `DemoActivity` in the Activity tab when demo is on (real `ActivityContent`
  when off)

## 6. Toolbar in demo

- [x] 6.1 In the status toolbar show a Demo indicator and hide Go live / End / Discard
  while demo is on; keep Save changes bound to the real Settings form

## 7. Verify

- [x] 7.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build` clean
- [x] 7.2 `npx openspec validate add-live-demo-mode --strict`
