## Context

The overlay stack is built from prop-driven visual components — `FeaturedAvatar`
(highlights), `GoalBar` (goals), `Plant` (competition) — each currently fed by a
realtime/polling hook off the database, which is in turn fed by the worker + YouTube.
None of that runs without a live broadcast. The goal overlay already shipped a
`DemoStage` with pointer drag + corner-handle resize for OBS layout testing. This
change generalizes that idea into a full harness: a real VOD plays underneath, the
three real overlay components sit on top in draggable boxes, and a control panel
simulates the events the worker would normally produce.

## Goals / Non-Goals

**Goals:**
- See the real overlays over real footage, reposition/resize them for OBS, and trigger
  each animation on demand — with no live stream, worker, YouTube, or DB writes.

**Non-Goals:**
- Validating the AI scoring **decisions** (rendering/layout only; AI quality is the
  live run, AZ-127).
- Persisting layouts; in-site overlays; any schema change.

## Decisions

- **Drive the real components with simulated client state.** The demo imports the
  exact `FeaturedAvatar`/`GoalBar`/`Plant` used in production and feeds them from React
  state instead of the DB hooks, so what the owner sees is pixel-identical to live —
  but nothing touches Supabase, the worker, or YouTube. *This bounds what the demo
  proves:* rendering, positioning, sizing, and animation timing — **not** whether
  `claude -p` picks good messages or fair scores. That distinction is called out in the
  guide and the spec.

- **Refactor `FeaturedAvatar` to `{ author, ringLevel, onDone }`.** Today it takes the
  whole `FeaturedMessageWithAuthor` row but only reads `author` and `ring_level`.
  Narrowing the props decouples the visual from the DB row so the demo can construct a
  feature trivially, and the live overlay passes `author={current.author}
  ringLevel={current.ring_level}`. *Alternative — build a full fake row in the demo:*
  ~13 throwaway fields and a cast; the refactor is cleaner and has one call site.

- **One generalized `DraggableResizable` wrapper.** The goal `DemoStage` already has
  the pointer-drag + corner-resize logic; extract it into
  `components/draggable-resizable.tsx` (`{x,y,scale}` + `onChange`, a drag surface and a
  resize handle) and wrap each of the three surfaces in one. *Rationale:* the demo needs
  three independently movable surfaces; one wrapper avoids duplicating the pointer math
  and can later replace the goal DemoStage's inline version.

- **VOD playback reuses existing infra.** `getOwnerVideosAction()` (owner-checked) lists
  the owner's `status='ready'` videos; the page plays the picked one with a native
  `<video controls src={vodAssetUrl(mp4_path)}>`. No new storage, no new player — the
  backdrop just needs to scrub, which native controls do.

- **Simulation matches production math.** Goals run through the same
  `computeGoalProgress(simCounts, simBaseline, simGoals)` with a "Start" button that
  snapshots the baseline exactly like `startGoalsAction`; competition runs through
  `plantShape`; highlights push a `FeaturedAvatar` with `ringLevel` = the viewer's
  simulated feature count. So the demo exercises the real mappings, only the inputs are
  fake. A roster of ~6 fake viewers carries both a Vids.Tube-style identity (handle + a
  channel-ish avatar) and YouTube-style identities (name + an avatar URL), built as
  plain `FeaturedAuthor` objects, so both render paths are visible.

- **Owner-guarded under studio.** `/studio/demo` uses `useRequireOwner()` like the rest
  of studio; a "Demo" link is added to the sidebar. Nothing here is public.

## Risks / Trade-offs

- [Demo gives false confidence about AI quality] → Explicitly scoped + documented: it
  verifies visuals/layout, not scoring decisions; the live run (AZ-127) remains the AI
  validation. The guide states this.
- [VOD CORS/codec in the `<video>` tag] → VODs are served from `cdn.vids.tube`
  (`vodAssetUrl`) as MP4, already played in the watch page; the same source works here.
- [Refactoring `FeaturedAvatar` touches the live overlay] → one call site, covered by
  tsc/build; behavior identical (same fields, narrower props).

## Migration Plan

None. Build the wrapper + page + action, refactor `FeaturedAvatar`, add the sidebar
link; verify with tsc/eslint/build. The drag/resize/simulate flow is owner-run in a
browser.

## Open Questions

- Whether to later persist the OBS layout (positions/scales) so the owner doesn't
  re-place sources each stream — deferred; the demo is for dialing in positions, which
  the owner then sets once in OBS.
