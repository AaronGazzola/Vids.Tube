## Context

`components/scheduled-card.tsx` exposes `ScheduledCard({ broadcast })`. When
`broadcast` is null it renders a static "No stream scheduled right now" box; when
present it renders `ComingSoonCard`. After `extract-standalone-live-stream-page`,
the sole caller (`LiveStreamView`) only renders `ScheduledCard` with a non-null
`broadcast`, so the empty branch is already dead UI.

## Goals / Non-Goals

**Goals:**
- The empty-state box never renders anywhere.
- The coming-soon/countdown branch is unchanged.

**Non-Goals:**
- Any change to the coming-soon card content, the live page, or callers.

## Decisions

- Remove the `broadcast`-null branch from `ScheduledCard` and return `null` in that
  case, keeping `ComingSoonCard` for the populated case. Rationale: minimal,
  matches the "render nothing" requirement, and removes now-dead markup rather than
  hiding it at the call site.

## Risks / Trade-offs

- [A future caller might rely on the empty placeholder] → None exists today; the
  redesign (AZ-67 follow-up) supersedes this slot entirely, so reintroducing a
  placeholder would be a deliberate future decision.
