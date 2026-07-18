## Context

- `/live` (from `unify-live-stream-page`) is the owner-only management page: Settings /
  Preview / Activity tabs plus a bottom status toolbar. Its Activity content is a set of
  presentational components in `app/(app)/live/panels.tsx` (`ActivityContent`,
  `GoalsHeader`, `Competition`, `CompetitorBadge`, `ChatPanel`, `ChatMessageRow`,
  `ModBotActions`, `ScoreBadge`), today fed by DB-backed react-query hooks.
- Overlay renderers already exist as standalone components: `components/overlay/goal-bar.tsx`,
  `highlighted-message.tsx`, `avatar-bubble.tsx`, and a draggable/resizable/scalable stage
  `components/overlay/goal-demo-stage.tsx` (drag, resize handle, scale, "Show full /
  in-progress" and background toggles, reset layout).
- Published VOD frames live on `videos.preview_paths` (array) + `thumbnail_path`, served
  from `NEXT_PUBLIC_VOD_BASE_URL` — the same source the hover slideshow in
  `components/video-card.tsx` uses.
- The worker only produces scoring by reading real `chat_messages` for the single
  live-eligible stream and calling the Claude CLI. The demo deliberately bypasses all of
  that.

## Decisions

### Demo is a non-destructive view layer

Demo is a client-only re-skin of `/live`. It never writes to `streams`, `chat_messages`,
`viewer_scores`, `featured_messages`, or `moderation_actions`, and never engages the
worker or YouTube. The only persistence is the demo **layout** (below). Because the real
stream row is never touched, toggling the switch off restores the real active stream and
any Settings the owner saved, verbatim. The Settings tab stays bound to the real stream
in both modes, so the owner can edit and save their broadcast while previewing — this is
what makes "switch off → see my saved changes" hold.

### Where demo state lives

`app/(app)/live/demo.stores.ts` holds two Zustand stores:

- **Generator store** — the simulated roster, the rolling chat feed, per-viewer scores,
  featured/highlighted messages, mod actions, and goal current-counts. A timer in a demo
  controller hook advances it (a new message every ~1–2s; a subset scored; a few
  featured; leaderboard and goal numbers tick). All derived with the production mappings
  (`computeStandings`, goal progress) so the visuals match live.
- **Layout store** — overlay positions/scales, per-overlay visibility, goal-progress
  (in-progress/full), and background choice. Hydrated from the DB on demo enable and
  written back on change (debounced) via `saveDemoLayoutAction`.

The demo *enabled* flag itself is ephemeral (defaults off on load) so the owner never
mistakes a reloaded page for a real broadcast.

### Reusing components, not re-plumbing hooks

Rather than thread a demo flag through every DB hook, the Activity and overlay
*presentational* components are fed from the generator store in demo mode. `panels.tsx`
exposes its presentational pieces so a `DemoActivity` wrapper can render the identical
header/competition/mod-actions/chat from demo state. The Preview demo stage generalizes
`goal-demo-stage.tsx` into an overlay stage that positions all surfaces.

### Overlay stage behavior

Over the slideshow: the three goal bars and the competition render as independently
draggable + resizable/scalable boxes; the highlighted-message and avatar bubbles play as
full-stage travelling animations (as they do live, using viewport units) and are not
repositionable — only toggleable. Controls on the stage: a show/hide toggle per overlay,
a goal-progress toggle (in-progress vs reached/rainbow), a background toggle
(slideshow / gradient / black), and reset layout.

### Slideshow source and controls

`getDemoFramesAction` (owner-checked) returns a pooled, ordered list of frame URLs from
the channel's `status='ready'` videos (`preview_paths` first, else `thumbnail_path`),
capped to a sane number. The Preview stage autoplays them on an interval; prev/next step
manually; selecting a frame pauses autoplay and holds it; a play/pause control resumes.
Empty state (no ready VODs) shows a message and still renders the overlays over a plain
background.

### Persistence: `demo_layouts`

New table, one row per channel:

```
demo_layouts(
  channel_id  uuid primary key references channels(id) on delete cascade,
  config      jsonb not null default '{}',
  updated_at  timestamptz not null default now()
)
```

`config` shape: `{ overlays: { [key]: { x, y, scale, visible } }, goalProgressFull: bool,
background: 'slideshow'|'gradient'|'black' }` where `key` ∈ {goalSubs, goalLikes,
goalViewers, competition, highlight, avatars} (highlight/avatars store only `visible`).
RLS enabled; access via owner-checked server actions using `supabaseAdmin`
(`getDemoLayoutAction`, `saveDemoLayoutAction`), consistent with the project's action
pattern.

### Tab bar: per-tab pop-out + demo switch

The tab bar right side holds, in order: the pop-out icon (rendered only when the active
tab is Preview or Activity, popping that tab's content) and the Demo `Switch` (a
shadcn/ui `Switch`, always present, far right). Preview pop-out uses a new
`panel=preview` mode on `/popout/[channelSlug]`; Activity pop-out is the existing
`panel=all`. Pop-out is disabled while demo is on (the demo stage is interactive and
not meaningfully poppable).

### Toolbar in demo

While demo is on, the toolbar replaces the status badge with a "Demo" indicator and
hides Go live / End / Discard (no lifecycle action applies to a simulated stream). Save
changes stays, still saving the real Settings form.
