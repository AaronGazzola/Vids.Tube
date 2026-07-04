## Why

The chat-scoring engine (AZ-112) already produces per-viewer scores in
`viewer_scores`, and the highlight overlay celebrates individual messages. The last
piece of the go-live overlay stack (AZ-124) is a *competition*: a playful overlay
where each viewer grows a plant tied to their engagement score, so the audience can
see who's contributing the most at a glance. This is the simple, score-driven v1 —
the bonsai/betting/keyboard evolution is tracked separately (AZ-107).

## What Changes

- **No schema change.** The overlay reads the existing `viewer_scores`
  (public-read), written by the scoring engine for both Vids.Tube and YouTube
  participants. Author/avatar resolution reuses `lib/featured-author.ts`
  (`authorFromRow`, `FeaturedAuthor`).
- **Pure growth mapping** (`lib/plant.ts`): `plantShape(score, topScore)` →
  the plant's relative height + leaf/flower tiers, so a viewer's plant grows with
  their `total_score` relative to the current leader. Unit-testable, no rendering.
- **Plant component** (`components/overlay/plant.tsx`): a transparent CSS/SVG plant
  (stem + leaf pairs + a top avatar bubble with the viewer's avatar and name) that
  animates its growth.
- **Competition overlay route** under the existing transparent `(overlay)` group:
  `/overlay/[channelSlug]/competition` renders a bottom-aligned "garden" of the top
  viewers' plants, sized relative to the leader; honors `?max=` (default 24) and
  `?height=`; shows nothing when the channel isn't live or has no scores. Driven by a
  `getCompetitionAction(channelSlug)` + `useCompetition` polling hook.
- **Studio**: the competition OBS URL is shown on `/studio/overlay` alongside the
  existing overlay + goals URLs.

- **Out of scope** (AZ-107 / future): bonsai growth, the keystroke betting market, the
  split-keyboard overlay, and in-site (watch page) rendering.

## Capabilities

### New Capabilities

- `avatar-competition`: the score-driven plant competition overlay — the pure growth
  mapping, the plant component, the transparent `/overlay/[channelSlug]/competition`
  route reading `viewer_scores`, and the studio OBS URL.

### Modified Capabilities

(none — reads existing `viewer_scores`; no requirement changes.)

## Impact

- **DB**: none. No migration. Reads `viewer_scores` (already public-read).
- **New files**: `lib/plant.ts`; `components/overlay/plant.tsx`;
  `app/(overlay)/overlay/[channelSlug]/competition/{page.tsx,page.hooks.tsx,page.actions.ts}`;
  a `scripts/verify-avatar-competition.ts` smoke check; a small studio edit.
- **Reuses**: `viewer_scores` + `ViewerScoreWithAuthor`, `lib/featured-author.ts`,
  `resolveAuthorIdentities`/`channelAssetUrl`, the transparent `(overlay)` layout, and
  `useChannel`/`useLiveStream` resolution.
- **Polling**: a short interval (default ~5s); `viewer_scores` is not added to the
  realtime publication (the scoring cadence is ~10s and plants grow gradually) — noted
  as a future enhancement.
- No changes to existing chat, streams, scoring, overlay, or goal behavior.
