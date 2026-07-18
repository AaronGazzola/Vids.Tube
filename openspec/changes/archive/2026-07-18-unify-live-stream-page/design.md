## Context

- Existing owner code to recompose (not rewrite): `app/(app)/go-live/page.{tsx,hooks,actions}`
  (stream key/regenerate, current broadcast, go-live, end, thumbnail) and
  `app/(app)/control/{page,overlay}.{tsx,hooks,actions}` (overlay context, scoring
  toggle, YouTube video, goals, leaderboard; chat/read-this/moderation actions).
- `app/(overlay)/popout/[channelSlug]/page.tsx` imports `useReadThisQueue` and
  `useViewerLeaderboard` from `control/` — must be repointed when `control/` moves.
- Public watch page `/[channelSlug]/live` (`live-stream-page`) is unaffected.
- Overlay renderers key off the single active stream (`overlay-control`,
  `goal-overlays`, `avatar-competition`, `featured-overlay`).
- Lifecycle, worker heartbeat, and waiting-room-chat + validation are defined in the
  three prerequisite changes.

## Decisions

### Page shape and active stream

`/live` is owner-only (`useRequireOwner`). It resolves the channel's single active
stream and derives page state from its `status`. With no active stream it shows an
empty/create state (Settings tab lets the owner configure a draft or schedule one).
Tabs: Settings, Preview, Activity, with a fixed status toolbar rendered outside the
tab switch.

### Settings save model

All Settings fields are edited as one form and persisted by the toolbar Save changes
button; Save is disabled while the form matches the DB. Saving writes the active row
(creating a `draft`/`scheduled` when none exists, editing it otherwise — see
`stream-lifecycle`), and runs the schedule-save validation + first-time-schedule
confirmation from `add-waiting-room-chat` when a datetime is persisted. The
schedule datetime field is disabled once the stream is public/live.

### Goals model

Three targets stored on the active stream. Subs is delta-based: capture a `subs_baseline`
when the stream becomes `scheduled` (or at go-live if never scheduled) and render
progress as `current − baseline` toward the target. Likes and viewers are absolute
current values from YouTube; no baseline, no manual start (removes the prior
"Start/Restart" control). The overlay renderers consume the same values.

### Mod bot switches

Auto-hide is always on (not a toggle; shown as fixed). Switches persisted on the
active stream / its scoring state:
- ban mode: `auto` vs `suggest`.
- chat scoring on/off (`chat_scoring_state.enabled`).
- featured highlighting on/off.
- auto-display featured in the highlight overlay — disabled in the UI when
  featured highlighting is off.
These map onto the existing modbot mode + scoring flags plus new booleans.

### Activity chat affordances

Reuse existing actions (`hide/unhide`, `ban/unban`, `promoteHighlight`, viewer
reasoning). New per-message UI states:
- hidden: thin collapsed row → popover Reveal → revealed shows hidden styling +
  Hide (recollapse) + Unhide (publish).
- feature-suggested: prominent styling + Highlight (promote to overlay) + Dismiss;
  after either, secondary styling.
- scored: score badge → popover with reasoning.
The mod bot actions component (Hidden/Banned tabs with counters, Unhide/Unban) reuses
the moderation feed. The Activity tab pops out via the existing `/popout` window with
the full tab contents.

### Removals and routing

Delete `/go-live` and `/control`; move their hooks/actions under `app/(app)/live/`
(and relocate the shared `overlay.*` so the pop-out can import it). Delete the dead
`app/live/page.tsx` and orphaned `components/live-banner.tsx`. Reclaim `/live` for the
owner page. Sidebar: Account + Go Live (→ `/live`).

## Risks

- Large recomposition; keep the existing actions/hooks and only reshape the UI +
  page/state wiring to reduce regression risk.
- Ensure the pop-out import repoint compiles (it currently reaches into `control/`).
- The schedule datetime disabled-when-public and the toolbar button enablement must
  match the lifecycle state exactly.
