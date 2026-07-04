## Context

The overlay stack and scoring bot are built; what is missing is the streamer's own
operating view. Everything it needs already exists as actions/hooks — this change is
composition, not new data. It deliberately ships read-only first so it is useful before
the moderation engine (AZ-135) lands.

## Goals / Non-Goals

**Goals:**
- One owner-only, pop-out-friendly window showing live chat, the AI's read-this queue,
  and a goal/score glance, reusing existing hooks with no new DB.

**Non-Goals:**
- Moderation actions/engine (AZ-135) — only inert slots here.
- Delegated mods (AZ-89), public chat overlay (AZ-131), layout persistence (AZ-136).

## Decisions

- **Resolve the stream from `getOverlayContextAction`.** It already returns the latest
  stream id + status + scoring-enabled for the owner's channel. The control room treats
  `streamStatus === "live" ? streamId : streamId` — it shows the most recent stream so the
  owner can prep before going live; a small badge shows live/offline.

- **Reuse, don't rebuild.** Chat = `useLiveChat` (realtime). Read-this = a local
  `useReadThisQueue` wrapping `getFeaturedMessagesAction` on an 8s poll (featured rows are
  low-frequency; polling is simpler than a second realtime channel and good enough).
  Glance = `useViewerLeaderboard`.

- **"Read this" is the headline panel.** Featured messages newest-first with `body`, the
  AI `reason`, and category tags. A local `Set` of dismissed ids implements "mark read"
  (ephemeral; no persistence needed for an operator aid).

- **Moderation slots are inert now.** Each chat row gets a disabled Hide; each author a
  disabled Ban, with a title explaining they arrive in AZ-135. This fixes the layout so
  wiring later is additive, and signals intent without dead-but-clickable controls.

- **Dense/dark, pop-out friendly.** Minimal chrome, fixed-height scrolling panels, so the
  owner can tear it into its own window on a second monitor next to OBS.

## Risks / Trade-offs

- [Featured poll vs realtime] → 8s poll is fine for an operator panel; can upgrade to the
  existing realtime `featured:` channel later if latency matters.
- [Most-recent-stream selection] → showing the latest (possibly ended) stream avoids an
  empty panel while prepping; the live/offline badge prevents confusion.

## Migration Plan

1. Add `useReadThisQueue` + the control page; add the sidebar item.
2. Verify tsc/eslint/build; `openspec validate --strict`.
3. Owner-run: open `/studio/control`, confirm chat + read-this populate during a stream
   (and against a seeded stream via `smoke:bot --keep`).

## Open Questions

- Whether to default-select the live stream only (hiding the panel when offline) vs the
  latest — shipping "latest with a badge"; revisit if it confuses.
