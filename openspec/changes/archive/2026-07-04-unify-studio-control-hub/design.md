## Context

Three studio pages overlap in purpose. `/studio/control` is already the operating surface
and already imports `useOverlayContext` + `useViewerLeaderboard` from
`app/studio/overlay/page.hooks.tsx`. The merge consolidates onto it without a DB change.

## Decisions

### Preview data source: live/test stream, not mock sim

`/studio/demo` drives its preview from hand-built mock viewers (`INITIAL_VIEWERS`) plus
manual bump buttons. We drop that. The merged Preview binds the same overlay components to
the **current stream's real data**:

- highlight → `usePromotedMessages(streamId)` (the promoted featured message, same source
  the public `/overlay/{slug}` uses)
- avatar bubbles + ranks → `useStreamStandings(streamId)`
- goal bars → goals from `useOverlayContext()`

Consequence: the preview is empty until there's data. In **test mode** the dry-run supplies
that data (promotes highlights, scores viewers, sets goals when `--youtube` is passed), so
the preview fills exactly as it would live. This is the user's chosen approach ("Dry-run
stream") and means there is one data path to trust, not two.

### Test-mode detection: stream title marker

`scripts/dryrun-stream.ts` already inserts its stream with
`title: "[DRY RUN] overlay + bot test"`. The control room reads the active stream's title
(already available via the stream resolution it does) and shows the test banner when the
title starts with `[DRY RUN]`. No new column, no migration. If we later want a first-class
flag we can add `streams.is_test`, but the marker is sufficient and zero-risk now.

### Layout state: local only

Preview box positions live in component state seeded from a `DEFAULT_BOXES` constant (ported
from demo), with a Reset button. Persisting across reloads is deferred to AZ-136 so this
change stays narrow.

### Retire by redirect, keep the hooks

`/studio/overlay` and `/studio/demo` page bodies are replaced with a server redirect to
`/studio/control`. The *hooks* file `app/studio/overlay/page.hooks.tsx` stays put (control
already imports from it); moving it would churn imports for no benefit. Sidebar loses the
two entries. Anyone with an old bookmark lands on the hub.

## Risks / Trade-offs

- **Bigger control page.** Mitigated by splitting Setup and Preview into collapsible
  sections that default collapsed, so the operating view (chat/read-this/leaderboard/mod)
  stays primary.
- **Preview only meaningful with data.** Acceptable: live or dry-run both provide it; an
  empty-state hint tells the owner to go live or run `npm run dryrun`.
- **Demo's mock-only affordances are lost** (e.g. opacity slider, manual score bumps). These
  were demo conveniences; the dry-run replaces their purpose. Not ported.
