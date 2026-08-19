# Tasks

## 1. Reading a person

- [ ] 1.1 `app/(app)/live/chatters.actions.ts`: `getChatterDetailAction(streamId, participantKey)`
      returning one person's public membership figures plus their remembering points. Resolve the
      participant to a membership by the same identity keys the membership recompute uses — the owner
      user id for vids.tube, the prefixed YouTube channel id otherwise.
- [ ] 1.2 Same action: use the RLS-bound server client, not the service role. The notes policy written
      by `add-chatter-recall-notes` returns nothing to a non-owner, which is the authorization; a check
      written here would be a second, weaker one. Confirm the action returns figures with an empty
      points list for a non-owner rather than erroring.
- [ ] 1.3 Return rank from `membership_rank`, badges joined through `membership_badges`, and this
      broadcast's messages and XP from `membership_stream_stats` for the stream being run.
- [ ] 1.4 Return the broadcasts-ago gap as a number, computed from that person's attended broadcasts
      against the channel's broadcast order. The wording is the component's job; the count is the
      action's.
- [ ] 1.5 `app/(app)/live/chatters.hooks.tsx`: `useChatterDetail(streamId, participantKey)`, enabled
      only when a key is supplied, so a collapsed card issues no query.

## 2. The avatar card

- [ ] 2.1 `components/chatter-card.tsx`: the figures, rendered by reusing `components/membership-card.tsx`
      rather than restating the same values, with the remembering points below it.
- [ ] 2.2 `components/recall-notes.tsx`: the collapsible points list, taking its starting open state as a
      prop. One component for the card and the roster row; only the prop differs.
- [ ] 2.3 Separate the standing points from the check-in points visually, and show each check-in's date,
      so a question about something six weeks old is asked knowingly.
- [ ] 2.4 `components/chat-author.tsx`: wrap the avatar in a popover trigger in all three branches —
      vids.tube, YouTube and bot. The vids.tube branch currently links the whole chip to the channel
      page; keep the name as that link and make the avatar the card trigger, so neither affordance is
      lost.
- [ ] 2.5 The bot has no membership. Suppress the trigger for bot authors rather than opening a card
      with nothing in it.
- [ ] 2.6 `tests/unit/chatter-card.test.tsx`: the points start collapsed; the figures render without the
      points open; a person with no points renders the first-time label; a non-owner sees figures and no
      points section.

## 3. The roster

- [ ] 3.1 `app/(app)/live/chatters.actions.ts`: `getBroadcastChattersAction(streamId)` returning one
      entry per distinct author in that broadcast's `chat_messages`, with the same shape as the single
      read, excluding the host and channels marked `is_software`.
- [ ] 3.2 `useBroadcastChatters(streamId)` in the hooks file, polling on the same cadence the other
      Activity reads in `app/(app)/live/page.hooks.tsx` use. Match the existing interval rather than
      choosing a new one.
- [ ] 3.3 Order the roster so recognition comes first: people who have not spoken in the current
      broadcast before this poll at the top, then by longest gap since their last broadcast, then by
      most recent message. Not by XP — the roster answers who needs greeting, not who is winning.
- [ ] 3.4 `components/chatter-roster.tsx`: the rows, each with avatar, name, origin, the figures laid out
      for scanning, this broadcast's figures beside the lifetime ones, the broadcasts-ago line, and the
      collapsible points.
- [ ] 3.5 Auto-open and auto-close, held in one hook in the roster component: a row opens when the person
      first appears in the poll, and a timer closes it 5 minutes later. Closing by hand clears that row's
      timer. The timer is created once per row and never re-created, so a row reopened by hand stays
      open.
- [ ] 3.6 `tests/unit/roster-disclosure.test.ts`: extract the open/close decision as a pure reducer and
      test it without rendering — a new arrival opens; the timer closes it; a hand close clears the
      timer; reopening after a hand close does not schedule a new one; a row already present on the
      first poll does not open itself.

## 4. Into the window

- [ ] 4.1 `app/(overlay)/popout/[channelSlug]/page.tsx`: add `panel=chatters`, rendering the roster.
      Follow the existing two branches exactly.
- [ ] 4.2 `app/(app)/live/page.tsx`: a second icon-only button beside the existing pop-out, shown only on
      the Activity tab and only when the Activity demo is off, opening
      `/popout/{slug}?panel=chatters` under its own window name so it does not replace the Activity
      pop-out.
- [ ] 4.3 Give the two buttons distinct icons and distinct accessible labels. Two identical icons side by
      side is the failure this task exists to prevent.
- [ ] 4.4 Confirm the header still reflows on a narrow viewport with the extra control present, per the
      existing requirement that no control is clipped at any width.

## 5. Land it

- [ ] 5.1 Open the roster during a broadcast, or against the most recently settled broadcast, and check
      the ordering puts the people who need greeting at the top. If it does not, the ordering rule is
      wrong and this is when to fix it.
- [ ] 5.2 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [ ] 5.3 `openspec validate --strict`.
