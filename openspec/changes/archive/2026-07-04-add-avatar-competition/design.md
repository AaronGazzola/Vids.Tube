## Context

`viewer_scores` (AZ-111 schema, populated by the AZ-112 scoring engine) already holds
per-viewer `total_score` / `features_count` for both Vids.Tube and YouTube
participants, keyed by `participant_key`, with the cross-origin identity fields and a
resolver (`lib/featured-author.ts`). The `(overlay)` route group is already
transparent and chrome-free (AZ-111). So the competition overlay is a display-only
addition: read `viewer_scores`, map each viewer's score to a plant size, render a
garden. Nothing new in the database.

## Goals / Non-Goals

**Goals:**
- A transparent overlay showing each top viewer as a plant that grows with their score.
- Both origins rendered with the correct avatar source.
- A pure, testable score→size mapping.

**Non-Goals:**
- Bonsai growth, betting, split-keyboard (AZ-107).
- In-site watch-page rendering.
- Realtime push (polling is enough here).

## Decisions

- **No migration; read `viewer_scores`.** The competition is purely a new view over
  data the scoring engine already writes. Author/avatar resolution reuses
  `authorFromRow` + `FeaturedAuthor` (channel path for `vidstube`, `author_avatar_url`
  for `youtube`), exactly as the highlight overlay and leaderboard do.

- **Poll, don't subscribe.** `getCompetitionAction(channelSlug)` is wrapped in a
  `useQuery` with a short `refetchInterval` (default ~5s). *Rationale:* the scoring
  engine updates `viewer_scores` on a ~10s cadence and plants grow gradually, so a
  5s poll captures every change with no perceptible lag — and it avoids adding
  `viewer_scores` to the `supabase_realtime` publication (a migration + a more complex
  UPDATE-event subscription). *Alternative — realtime:* snappier in theory but
  pointless against a 10s producer; noted as a future enhancement if scoring ever goes
  sub-second.

- **Growth is a pure function.** `lib/plant.ts` `plantShape(score, topScore)` returns
  `{ growth (0..1), stemPx, leafPairs, flowers }`: `growth = topScore > 0 ? score /
  topScore : 0` (the leader is the tallest, everyone else relative to them); `stemPx`
  interpolates a min→max height by `growth`; `leafPairs` and `flowers` step up at score
  tiers (and `features_count` adds accent flowers). Pure → unit-testable for
  monotonicity, clamping, and the tiers, with no rendering. *Rationale:* the mapping is
  the only real logic; keeping it pure makes "bigger score ⇒ bigger plant" verifiable
  without a browser.

- **Plant is transparent CSS/SVG.** `components/overlay/plant.tsx` draws a stem (a thin
  rounded green column whose height = `stemPx`, with a CSS height transition so growth
  animates), leaf pairs on alternating sides, optional accent flowers, and a top avatar
  bubble (`Avatar` with `avatarUrl ?? channelAssetUrl(avatarPath)` + initials fallback)
  with the viewer's name below. No background.

- **Route drops into the transparent group.** `app/(overlay)/overlay/[channelSlug]/
  competition/page.tsx` resolves channel→live stream (`useChannel`+`useLiveStream`),
  polls `useCompetition`, and renders a bottom-aligned flex row of `Plant`s ordered by
  score (leader first or centered), one per top viewer. It honors `?max=` (cap, default
  24) and `?height=`, and renders nothing when not live or there are no scores. No new
  layout needed.

- **Studio shows the URL.** `/studio/overlay` gains the copyable
  `/overlay/<channelSlug>/competition` URL next to the existing overlay + goals URLs —
  no new control surface (featuring is the same toggle that drives scoring).

## Risks / Trade-offs

- [All scores equal / one dominant leader] → `growth` is relative to `topScore`; a lone
  leader is full-height and others scale down proportionally, which reads fine. A single
  participant is simply one full plant.
- [Many participants overflow the row] → `?max=` caps the count (default 24) and the row
  wraps/scales; the leader set is the top-N by `total_score`.
- [Polling cost] → one lightweight query every ~5s per open overlay; negligible.
- [No live data until the bot runs] → expected; the overlay is empty until AZ-112 scores
  a live stream. Verified by inserting `viewer_scores` rows and confirming the action +
  shape.

## Migration Plan

None. Build `lib/plant.ts` + the component + route + studio URL; verify with
`scripts/verify-avatar-competition.ts` (pure `plantShape` + `getCompetitionAction` over
inserted test rows) and tsc/eslint/build.

## Open Questions

- Final visual tuning (heights, tiers, leaf/flower art) — ship sensible defaults, tune
  against a real garden.
- Ordering/layout (leader-centered vs left-to-right) — start left-to-right by score;
  revisit after the live shake-out.
