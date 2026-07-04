## Context

The overlay visuals shipped as first drafts: highlights fly an avatar across with a
name, competition grows plants, and the demo moves grouped surfaces. The owner's
direction redefines the target UX: a ringed/badged avatar bubble as the shared identity
chip, a floating-bubble competition, and a highlight that shows the actual chat message.
The demo must let each element be placed individually and simulate the live AI flow.

## Goals / Non-Goals

**Goals:**
- A shared rank-aware avatar bubble; a floating-bubbles competition; a message-card
  highlight that shows the chat text; a demo that simulates the full live UX.

**Non-Goals:**
- The standalone chat overlay (AZ-131); bonsai/betting (AZ-107); persisting layouts.

## Decisions

- **Standings are a pure helper.** `lib/standings.ts` `computeStandings(scores)` sorts
  by score and returns, per participant, `{ rank, progress }` where `progress = topScore
  > 0 ? score / topScore : 0` (leader = 1, full ring). Rank 1/2/3 get gold/silver/bronze;
  others gray. Pure → unit-testable; used by both the competition overlay and the
  highlight (to ring the featured author). This replaces `lib/plant.ts`.

- **`AvatarBubble` is the shared identity chip.** `components/overlay/avatar-bubble.tsx`
  draws the avatar inside an SVG circular progress ring (stroke-dasharray by `progress`,
  color by `rank`) with a small 1/2/3 badge for ranks 1-3. Used by the floating
  competition and inside the highlight card, so identity looks consistent everywhere.

- **Competition becomes floating bubbles.** The competition route renders an
  `AvatarBubble` per viewer with `score > 0`, absolutely positioned in the **bottom
  third**, at low opacity, each drifting via a CSS float keyframe (varied per index so
  they don't move in lockstep). The plant component + `lib/plant.ts` are deleted.
  *Rationale:* matches the requested "bubbles floating around" read and reuses the shared
  chip + standings.

- **Highlight becomes a message card.** `components/overlay/highlighted-message.tsx`:
  a flex row — left column is the `AvatarBubble` (ring + badge) with `@handle` and name
  under it; right is a speech bubble (rounded, white outline over a translucent dark fill
  for legibility on video) showing the message text, with a tail near its top-left
  pointing at the avatar. It animates in, holds, and fades out, then calls `onDone`.
  `FeaturedAvatar` is replaced by this; the overlay queue plays one card at a time.
  *Trade-off:* a true hollow-outline tail is finicky; a translucent-fill bubble reads as
  an outline and stays legible over footage.

- **`featured_messages.body` carries the text.** The highlight needs the message text.
  Add a nullable `body text` column; the scoring engine writes the buffered message's
  text when it features. The highlight overlay reads `body`, and computes the author's
  `{rank, progress}` from the stream's `viewer_scores` (fetched alongside) so the card's
  avatar is ringed/badged.

- **Demo: portrait, per-element, full-UX sim.** The stage is a 9:16 portrait box. Each
  element (the goal bars individually, the highlight card, and the bubbles field) is its
  own `DraggableResizable`, so positions match the separate OBS Browser Sources. The
  control panel simulates the live flow: post a chat message as a roster viewer (text +
  author), "highlight" it (renders the message card), and +/- a viewer's score (moves
  the floating bubbles and re-ranks). This lets the owner walk the whole UX — what the AI
  will produce — without a live stream. *Scope reminder:* it simulates the AI's
  *outputs*, not its *decisions*; decision quality is still the live run (AZ-127).

## Risks / Trade-offs

- [Speech-bubble tail fidelity] → translucent-fill bubble + a matching tail triangle;
  legible and clearly a speech bubble, tunable later.
- [Many bubbles overlap in the bottom third] → low opacity + size cap + a max count;
  bubbles are meant to read as an ambient crowd, not a precise chart.
- [Migration on a live table] → `featured_messages.body` is additive + nullable; owner OK
  before `db push`.
- [Removing plants] → `Plant`/`lib/plant.ts` + their verify script are deleted; the
  competition route + demo switch to bubbles in the same change so nothing dangles.

## Migration Plan

1. `npx supabase migration new add_featured_message_body`; `add column body text`.
2. Owner OK → `db push` → `npm run db:types`.
3. Build the helper + components; switch the competition + highlight routes; write `body`
   in the scorer; rebuild the demo. Delete plants.
4. Verify: `computeStandings` unit test, tsc/eslint/build. Live render is owner-run.

## Open Questions

- Exact float motion, bubble sizes, and card timing — ship sensible defaults, tune in the
  demo.
- Whether the highlight should also show the score/category — start with just the text +
  identity.
