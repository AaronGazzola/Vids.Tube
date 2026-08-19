## Why

Everything the channel knows about a chatter is now stored: the public figures on their membership,
and the private remembering points written by `add-chatter-recall-notes`. None of it is reachable
while a broadcast is running.

Two different questions need answering during a broadcast, and they want different shapes.

"Who is this, who just spoke?" is asked about one person, prompted by a message on screen. That wants
a click on the avatar already in the chat.

"Who is here tonight?" is asked about everybody, and is not prompted by anything — which is exactly
why it never gets asked. A message has to scroll past before a person crosses the streamer's mind, and
by then the moment to greet them has gone. That wants a standing list, on the second monitor, beside
OBS.

## What Changes

- Clicking a chat author's avatar in the Activity tab opens a card of that person's public membership
  figures, with their remembering points below in a section that starts collapsed.
- The Activity tab gains a second pop-out control opening a roster of everyone who has spoken in the
  broadcast so far, each row carrying the same figures and the same points.
- The roster is pop-out only, and does not appear in the tab. The Activity tab is already specified to
  fit between the tab bar and the status toolbar without the page scrolling, with only the chat
  scrolling; a roster inside it would take that space from the chat. The per-person question is already
  answered in-tab by the avatar card, so the tab loses nothing.
- A row for someone arriving for the first time this broadcast opens itself, and closes again five
  minutes later. Collapsing a row by hand cancels that row's timer, so a row reopened afterwards stays
  open.
- A row says when that person was last here in words — "last here 3 broadcasts ago" — because that is
  the fact being looked for, and a date is not it.
- A chatter with no notes is labelled as new rather than shown an empty section or a spinner. Nothing
  is generated on demand.

## Capabilities

### New Capabilities

- `chatters-panel`: a pop-out roster of everyone who has spoken in the broadcast being run, with
  public figures and private remembering points per person.

### Modified Capabilities

- `streamer-control-room`: a chat author's avatar becomes a click target opening that person's figures
  and remembering points.
- `live-stream-management`: the Activity tab carries a second pop-out control for the roster.

## Impact

- The existing pop-out window gains a third panel choice alongside the preview and the Activity panel.
  The window, its chrome suppression and its opener already exist, so the plumbing is one more branch.
- The membership figures card built for channel pages is reused rather than a second stats layout being
  written. One component renders the remembering points for both the card and the roster row; only the
  starting state differs.
- An owner-authenticated read of the notes, relying on the policy written by `add-chatter-recall-notes`
  rather than on a check inside the action.
- **Not in this change:** the per-message scoring breakdown. `getViewerReasoningAction` and
  `useViewerReasoning` are unreferenced but deliberately retained for the studio chatter page (AZ-279),
  which is where "why did this score move" belongs. The spec requirement that named the deleted control
  room leaderboard was retired separately by `retire-score-reasoning-surface`. Do not delete that code
  while tidying this change.
- **Not in this change:** the highlight ring marking a returning chatter's message in the chat, held in
  AZ-172; the welcome-back bot line drawing on the same points, held in AZ-173; playback of a chatter's
  name, held in AZ-275; any public exposure of the points, governed by AZ-229.
