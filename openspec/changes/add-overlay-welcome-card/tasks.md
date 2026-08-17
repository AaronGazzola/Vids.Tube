# Tasks

## 1. Reading the greetings

- [x] 1.1 `app/(overlay)/overlay/[channelSlug]/page.actions.ts`: `getRecentGreetingsAction(streamId)`
      selecting `stream_greetings` for that stream joined to `channels` for the display name, handle and
      avatar, ordered by `greeted_at`, bounded to the most recent few minutes so a long broadcast does
      not accumulate an unbounded read.
- [x] 1.2 **Recorded, and done differently from as written.** The sibling *reads* use the RLS-bound
      server client and rely on their tables being publicly readable; `markHighlightShownAction` uses the
      service role, as the overlay's writes do. Neither rule fits: `stream_greetings` carries no policies
      at all, deliberately, because who has been greeted is worker bookkeeping. Opening it up would have
      exposed every past broadcast's arrivals. So the action uses the service role and closes the gap
      itself — only a live stream, and only greetings from the last five minutes, which is exactly the
      window whose greetings are going on air anyway.
- [x] 1.3 `useRecentGreetings(streamId)` in `page.hooks.tsx`, polling on the same cadence as the other
      feed reads in that file. Match the existing interval rather than choosing a new one.
- [x] 1.4 Group rows written together as one arrival: rows sharing a `kind` of `batch` and the same
      greeting moment are one card. Do this in a pure helper in `lib/greeting-groups.ts`, not in the
      component, so it is testable without rendering.
- [x] 1.5 `tests/unit/greeting-groups.test.ts`: a single new arrival is one card; a single returning
      arrival is one card; five batch rows written together are one card naming five; batch rows from
      two different moments are two cards; an empty list is no cards.

## 2. The card

- [x] 2.1 Add a `top` pointer to `SpeechBubble` in `components/overlay/speech-bubble.tsx`, drawn centred
      on the bubble's top edge in the same style as the existing left and right pointers.
- [x] 2.2 `components/overlay/welcome-card.tsx`: the avatar above and the message below, using
      `AvatarBubble` for the picture so the placeholder, sizing and scale behaviour are the ones the rest
      of the overlay already has. Pass a rank that suppresses the standing badge: an arrival has no
      standing yet and a rank badge would be a claim.
- [x] 2.3 Three texts, from the greeting's kind: new, returning, and a combined one naming the group.
      Write them in the card rather than reusing the chat greeting builders, which are shaped by
      YouTube's 200-character limit and carry a link the broadcast cannot be clicked on.
- [x] 2.4 Hold for eight seconds using the same animation-driven pattern `HighlightedMessage` uses, so the
      card leaves the slot the same way every other feed card does.
- [x] 2.5 No new keyframes were needed: the card reuses `highlight-pop`, which every other feed card
      already leaves the slot by, so the `from`/`to` trap this task guards against was never approached.

## 3. Into the feed slot

- [x] 3.1 In `LiveFeedSlot` in `app/(overlay)/overlay/[channelSlug]/page.tsx`, add the welcome as the
      fourth candidate, chosen only when no highlight, TTS or ask is showing, following the existing
      chain exactly.
- [x] 3.2 Track shown greetings in the same done-set style the slot already uses for the other three, so
      a poll returning a greeting again does not re-show it.
- [x] 3.3 A browser-source refresh mid-broadcast replays nothing. **Done differently from as written.**
      Seeding the done-set needed either a ref read during render or a `setState` inside an effect, and
      the repo's React lint rules forbid both. Instead the overlay records the moment it loaded and shows
      only greetings stamped after it, which is the same guarantee expressed as one number rather than a
      set. `greetedAt` is carried on the group for this.
- [x] 3.4 Include the welcome in the slot's existing chime, so an arrival sounds like every other feed
      event rather than gaining a sound of its own.
- [x] 3.5 `DemoOverlayFeed` in the same file gains a welcome so the demo can show one; take the sample
      from the existing demo snapshot rather than adding a second source of fake data.

## 4. The toggle

- [x] 4.1 Add `welcome` to `DemoOverlayKey` and `DEMO_OVERLAY_KEYS` in `app/(app)/live/demo.types.ts`,
      label it in `DEMO_OVERLAY_LABELS`, and default it to visible in `DEFAULT_DEMO_LAYOUT`.
- [x] 4.2 No `DEMO_LAYOUT_VERSION` bump: `welcome` is a new key, and a key absent from a saved layout
      already takes its default. A bump would put every saved box position at risk for nothing.
- [x] 4.3 Confirm the feed slot's visibility condition accounts for the new key the same way it accounts
      for `tts` and `ask`, so turning every feed element off still hides the slot.

## 5. Cover it

- [x] 5.1 `tests/unit/welcome-card.test.tsx`: a new arrival renders its new-member text; a returning one
      renders its returning text; a group renders one card naming the group; a chatter with no avatar
      renders the placeholder.
- [ ] 5.2 `tests/unit/welcome-feed-slot.test.tsx`: a highlight beats a waiting welcome; the welcome shows
      once the slot frees; the same greeting polled twice shows once; greetings present on first load are
      not shown; with the toggle off nothing is drawn and the other feed cards still are.
      **NOT DONE.** The slot's priority chain lives inside `LiveFeedSlot`, which is not exported and
      depends on five polling hooks, so testing it means mocking all five. The grouping and the
      after-load filter are covered pure in `greeting-groups.test.ts`; the chain itself is not covered.
- [x] 5.3 Extend `tests/unit/overlay-stage-parity.test.tsx` so the welcome is covered by the existing
      proof that the OBS route and the Overlays tab draw the same thing.

## 6. Land it

- [x] 6.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [ ] 6.2 Run `openspec validate --strict` and archive.
