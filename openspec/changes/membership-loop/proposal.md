## Why

Every chatter already gets a channel and a membership, but nothing tells them so: the overlay never mentions it, the bot never greets them, and the page they would land on shows four numbers and a claim button. The loop that makes the community visible — see the member count, chat, get welcomed, follow a link, find yourself on a leaderboard — has no working path end to end, so the next broadcast cannot honestly say "everyone who chats is a member."

The member count that would go on the overlay is also not yet truthful: Nightbot holds a membership with 75 messages, two test accounts hold memberships, and one person (Lehmo) is counted twice because they chatted both on YouTube and on the site without linking the two.

## What Changes

- The subscriber goal overlay box is retired and replaced by a **members box**: the community's member total and the call to action `vids.tube/...`. The total rises the moment a new member is welcomed. Likes and viewers goals are untouched.
- The bot greets every chatter on their **first message of a broadcast**, once per broadcast:
  - A first-time chatter is welcomed as a new member.
  - A returning chatter is welcomed back with a line drawn from their past messages.
  - Both carry a clickable `https://` link to that chatter's own channel page, anchored to their membership.
  - Above 5 chatters waiting at once, the overflow is named together in one message with the fixed address and no personal links.
- A per-broadcast switch on `/live` turns the returning-chatter greeting on and off.
- Membership is computed inside onboarding on **every** chatter's first message of a broadcast, not only when the channel is newly created — so a membership always exists before the greeting fires, including for a chatter who is new to *this* community but not to the platform.
- Every channel page gains a **memberships section** listing the communities that channel has chatted in, with live communities first, the membership named in the link highlighted, and a scroll to it once loaded. This renders on unclaimed channel pages too, which is 144 of 148 members.
- A channel that has hosted a broadcast gains a **community section** below the live-or-upcoming card: member total, who is chatting in the current broadcast, and the leaderboard.
- **Badges** are introduced as definitions plus awards against a membership, with "Day One" awarded to every current real member and the cutoff set to the change date.
- Nightbot is marked as software and the two test channels are removed. The member count is defined as memberships whose channel carries a YouTube identity, excluding software — a definition that neither drops when someone claims their account nor double-counts them beforehand.
- The claim call to action on a channel page is broadened from owners only to anonymous visitors and signed-in users without a verified YouTube link, and redesigned to be unobtrusive but apparent.
- The `!me` reply carries the same personal membership link, replacing the current bare-text `vids.tube/handle` nudge.
- A merge into a channel that is already a merge signpost is forbidden at the database level, so the one-hop redirect lookup can never reach a dead end.

## Capabilities

### New Capabilities
- `membership-badges`: badge definitions, awards joining a badge to a membership, and the retroactive Day One award
- `chatter-greeting`: the bot's once-per-broadcast greeting for new and returning chatters, its personal link, its burst behaviour, and its per-broadcast switch
- `member-count-overlay`: the members overlay box, its count definition, its call to action, and its live updating
- `channel-memberships-section`: the memberships a channel holds, rendered on every channel page including unclaimed ones
- `channel-community-section`: the members, live chatters and leaderboard of a channel that has hosted

### Modified Capabilities
- `memberships`: adds the member-count definition and the exclusion of software identities from counts, leaderboards and awards
- `live-chatter-onboarding`: membership is computed on every chatter's first message of a broadcast, not only when the channel is created
- `channels`: adds a software marker; an unclaimed channel page keeps the full page structure instead of being replaced by a claim card
- `channel-claim-hint`: the claim call to action is shown to anonymous visitors and to signed-in users without a verified link, not only to the channel owner
- `me-command`: the reply carries a clickable personal membership link
- `identity-merge`: a merge into a channel that is already a merge signpost is rejected
- `unclaimed-channels`: an unclaimed profile gains the memberships section instead of being a stats strip and a claim card only

## Impact

- Database: new badge definition and award tables; a software marker on channels; a constraint on merge targets; removal of two test channels.
- Worker: onboarding computes membership for every first message; a new greeting step in the live chat loop; the `!me` reply link format.
- Overlay: the members box replaces the subs goal box in the saved layout, which requires a layout version bump so older saved layouts fall back cleanly.
- Web: memberships section and community section on channel pages; the broadened claim call to action; the unclaimed channel page no longer replacing the full page.
- Scripts: a one-off Day One award run, and the test-channel removal.
- Not in scope, tracked as Linear tickets: site memberships held pending a YouTube declaration, the claim pathway across sign-up, the Regular and Squad badges, automatic badge evaluation, the custom text overlay element, leaderboard periods, and the floating live player.
