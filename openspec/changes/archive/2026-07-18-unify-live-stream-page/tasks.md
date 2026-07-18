## 1. Reclaim /live and relocate code

- [x] 1.1 Create `app/(app)/live/` page; move go-live + control + overlay
  hooks/actions under it (recompose, do not rewrite the action logic)
- [x] 1.2 Relocate the shared `overlay.actions.ts`/`overlay.hooks.tsx` so
  `app/(overlay)/popout/[channelSlug]/page.tsx` can import them; repoint its imports
- [x] 1.3 Delete `app/(app)/go-live/`, `app/(app)/control/`, `app/live/page.tsx`, and
  `components/live-banner.tsx`
- [x] 1.4 Sidebar (`components/app-sidebar.tsx`): show only Account and Go Live (→ `/live`)

## 2. Page shell + state

- [x] 2.1 Owner-gate with `useRequireOwner`; resolve the single active stream and
  derive state (`none`/`draft`/`scheduled`/`preview`/`live`)
- [x] 2.2 Tab bar (Settings/Preview/Activity) pinned at the TOP and the status
  toolbar pinned at the BOTTOM, both fixed across tabs while content scrolls between
  them (rendered outside the tab switch)

## 3. Settings tab (single column)

- [x] 3.0 Add `components/ui/switch.tsx` (shadcn/ui Switch); add DB columns
  `chat_scoring_state.highlighting_enabled bool default true` and
  `auto_display_featured bool default false` (migration + push + types)
- [x] 3.1 Broadcast details: title, description, thumbnail, schedule datetime
  (datetime disabled when public/live)
- [x] 3.2 Connection: stream key + RTMP + regenerate
- [x] 3.3 YouTube stream URL input
- [x] 3.4 Goals: subs (delta from auto-set baseline), likes/viewers (absolute); NO
  Save-targets / Start / Restart buttons — targets save via toolbar Save changes,
  baseline recaptured on schedule/go-live
- [x] 3.5 Overlays: copy URL + dimensions for Highlights, Goal subs/likes/viewers,
  Competition; competition opacity control; copyable even with no active stream
- [x] 3.6 Mod bot switches as shadcn `Switch`es: auto-hide fixed-on (disabled switch);
  ban mode (auto/suggest); scoring on/off; featured highlighting on/off; auto-display
  featured (disabled when highlighting off). Persist via Save changes
- [x] 3.7 Waiting-room chat toggle (shadcn `Switch`)
- [x] 3.8 Worker reminder: copy-command + running/stopped indicator (heartbeat)
- [x] 3.9 Settings content stacked in a SINGLE column

## 4. Preview tab

- [x] 4.1 Video player: private preview HLS in `preview`, public HLS in `live`
- [x] 4.2 Auto-scrolling live transcription (populated only while `live`)

## 5. Activity tab (order: header → mod bot actions → chat)

- [x] 5.1 Header: subs/likes/viewers goal progress; collapsible competition —
  collapsed shows the top 3 as badges (rank/avatar/handle/score) left-to-right
  highest→lowest; expanded shows a vertical full ranking; no ban controls
- [x] 5.2 Live chat: three-dot menu (hide/ban); hidden collapse → Reveal popover →
  hidden styling + Hide/Unhide; feature-suggested prominent styling + Highlight +
  Dismiss → secondary styling; score badge → reasoning popover
- [x] 5.3 Mod bot actions component ABOVE the chat: collapsible (collapsed default),
  Hidden/Banned tabs with counters, suggested + auto-enacted cases with original
  message + reasoning + Unhide/Unban
- [x] 5.4 Pop out the full Activity tab into its own window (reuse `/popout`)
- [x] 5.5 Activity fits the page without page scroll: header/competition/mod-bot at
  natural height; chat fills the remaining space (min 250px) and is the only thing
  that scrolls

## 6. Status toolbar

- [x] 6.1 Left: stream status
- [x] 6.2 Red Go live / End stream button (disabled unless `preview`/`live`); Discard
  in `draft`/`scheduled`/`preview`; each with a confirmation dialog (discard-in-preview
  wording explains a blank preview will remain)
- [x] 6.3 Middle: view count when `live`, waiting count when `scheduled`
- [x] 6.4 Right: Save changes (disabled when form equals DB); runs schedule-save
  validation + first-time-schedule confirmation when a datetime is persisted

## 7. Verification

- [x] 7.1 `npx tsc --noEmit`, `npx eslint`, `doppler run -- npm run build` pass; route
  table shows `/live`, no `/go-live` or `/control`
- [x] 7.2 Drive each state: none → create draft/schedule → preview (simulated connect)
  → go live → end; discard confirmations; save disabled when unchanged; pop-out opens
