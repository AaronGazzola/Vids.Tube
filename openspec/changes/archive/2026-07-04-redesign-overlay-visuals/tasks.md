> Reconciliation (2026-07-04): all tasks verified implemented in the codebase —
> `lib/standings.ts`, `avatar-bubble.tsx`, `highlighted-message.tsx`, the floating-bubbles
> competition page, and the `featured_messages.body` column/write are all present; the
> `Plant`/`FeaturedAvatar`/`lib/plant` files are deleted with no remaining references. The
> section 4 demo-stage work was delivered as the overlay preview inside `unify-studio-control-hub`
> (the standalone `/studio/demo` page is retired). Owner-run browser checks are covered by the
> live-verify Linear tickets.

## 1. Standings + avatar bubble

- [x] 1.1 `lib/standings.ts`: `computeStandings(items: { id, score }[])` → `Map<id, { rank, progress }>` (`progress = topScore>0 ? score/topScore : 0`); `rankColor(rank)` → gold/silver/bronze/grey
- [x] 1.2 `components/overlay/avatar-bubble.tsx`: avatar inside an SVG circular ring (stroke-dasharray by `progress`, colour by `rank`), a 1/2/3 badge for rank≤3; props `{ author, progress, rank, size? }`

## 2. Floating-bubbles competition

- [x] 2.1 Add a `bubble-float` keyframe set to `app/globals.css` (gentle drift; varied via animation-delay per index)
- [x] 2.2 `app/(overlay)/overlay/[channelSlug]/competition/page.tsx`: render an `AvatarBubble` per viewer with `score>0`, absolutely placed in the bottom third at low opacity, floating; rank/progress from `computeStandings`
- [x] 2.3 Delete `components/overlay/plant.tsx`, `lib/plant.ts`, `scripts/verify-avatar-competition.ts`'s plant asserts (replace with a `computeStandings` check)

## 3. Highlight message card

- [x] 3.1 Migration `npx supabase migration new add_featured_message_body`: `alter table public.featured_messages add column body text`; owner OK → `db push` → `npm run db:types`
- [x] 3.2 `worker/jobs/score.ts`: include `body: <message text>` when inserting `featured_messages`
- [x] 3.3 `components/overlay/highlighted-message.tsx`: left = `AvatarBubble` + `@handle`/name; right = speech bubble (rounded, outline over translucent fill) with the text + a tail pointing at the avatar; animate in/hold/out then `onDone`
- [x] 3.4 Replace `FeaturedAvatar` usage in `app/(overlay)/overlay/[channelSlug]/page.tsx` with `HighlightedMessage`; the action/hook returns `body`, and the page computes the author `{rank,progress}` from the stream's `viewer_scores`; delete `components/overlay/featured-avatar.tsx`
- [x] 3.5 `getFeaturedMessagesAction` selects `body`; add a parallel `viewer_scores` read (or reuse) to supply standings

## 4. Demo redesign

- [x] 4.1 `app/studio/demo/page.tsx`: portrait (9:16) stage; each goal bar, the highlight card, and the bubbles field wrapped in its own `DraggableResizable`
- [x] 4.2 Simulation: roster of viewers (handle/name + avatar + score + features + a sample message); controls to post-a-message-as-viewer, highlight it (renders `HighlightedMessage`), and +/- score (re-ranks bubbles); reset controls
- [x] 4.3 Drive the real `AvatarBubble`/`HighlightedMessage`/`GoalBar` with the simulated state; use `computeStandings` for ranks

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint` (0 errors), `npm run build` pass; no dangling references to `Plant`/`FeaturedAvatar`/`lib/plant`
- [x] 5.2 `scripts/verify-overlay-visuals.ts` (`doppler run -- tsx`): unit-check `computeStandings` (leader progress 1 + rank 1, relative progress, rank colours) and confirm `featured_messages.body` is writable by the service key + readable by anon; clean up
- [x] 5.3 (owner-run, browser) On `/studio/demo`: portrait stage; drag each element independently; post + highlight a message (card shows text + ringed avatar); change scores (bubbles re-rank/float); goal bars still work
