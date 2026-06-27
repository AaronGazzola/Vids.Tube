## 1. Standings + avatar bubble

- [ ] 1.1 `lib/standings.ts`: `computeStandings(items: { id, score }[])` → `Map<id, { rank, progress }>` (`progress = topScore>0 ? score/topScore : 0`); `rankColor(rank)` → gold/silver/bronze/grey
- [ ] 1.2 `components/overlay/avatar-bubble.tsx`: avatar inside an SVG circular ring (stroke-dasharray by `progress`, colour by `rank`), a 1/2/3 badge for rank≤3; props `{ author, progress, rank, size? }`

## 2. Floating-bubbles competition

- [ ] 2.1 Add a `bubble-float` keyframe set to `app/globals.css` (gentle drift; varied via animation-delay per index)
- [ ] 2.2 `app/(overlay)/overlay/[channelSlug]/competition/page.tsx`: render an `AvatarBubble` per viewer with `score>0`, absolutely placed in the bottom third at low opacity, floating; rank/progress from `computeStandings`
- [ ] 2.3 Delete `components/overlay/plant.tsx`, `lib/plant.ts`, `scripts/verify-avatar-competition.ts`'s plant asserts (replace with a `computeStandings` check)

## 3. Highlight message card

- [ ] 3.1 Migration `npx supabase migration new add_featured_message_body`: `alter table public.featured_messages add column body text`; owner OK → `db push` → `npm run db:types`
- [ ] 3.2 `worker/jobs/score.ts`: include `body: <message text>` when inserting `featured_messages`
- [ ] 3.3 `components/overlay/highlighted-message.tsx`: left = `AvatarBubble` + `@handle`/name; right = speech bubble (rounded, outline over translucent fill) with the text + a tail pointing at the avatar; animate in/hold/out then `onDone`
- [ ] 3.4 Replace `FeaturedAvatar` usage in `app/(overlay)/overlay/[channelSlug]/page.tsx` with `HighlightedMessage`; the action/hook returns `body`, and the page computes the author `{rank,progress}` from the stream's `viewer_scores`; delete `components/overlay/featured-avatar.tsx`
- [ ] 3.5 `getFeaturedMessagesAction` selects `body`; add a parallel `viewer_scores` read (or reuse) to supply standings

## 4. Demo redesign

- [ ] 4.1 `app/studio/demo/page.tsx`: portrait (9:16) stage; each goal bar, the highlight card, and the bubbles field wrapped in its own `DraggableResizable`
- [ ] 4.2 Simulation: roster of viewers (handle/name + avatar + score + features + a sample message); controls to post-a-message-as-viewer, highlight it (renders `HighlightedMessage`), and +/- score (re-ranks bubbles); reset controls
- [ ] 4.3 Drive the real `AvatarBubble`/`HighlightedMessage`/`GoalBar` with the simulated state; use `computeStandings` for ranks

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit`, `npx eslint` (0 errors), `npm run build` pass; no dangling references to `Plant`/`FeaturedAvatar`/`lib/plant`
- [ ] 5.2 `scripts/verify-overlay-visuals.ts` (`doppler run -- tsx`): unit-check `computeStandings` (leader progress 1 + rank 1, relative progress, rank colours) and confirm `featured_messages.body` is writable by the service key + readable by anon; clean up
- [ ] 5.3 (owner-run, browser) On `/studio/demo`: portrait stage; drag each element independently; post + highlight a message (card shows text + ringed avatar); change scores (bubbles re-rank/float); goal bars still work
