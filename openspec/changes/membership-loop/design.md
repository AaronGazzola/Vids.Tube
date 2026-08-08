## Context

Chatters already become members: the worker creates a channel on a chatter's first message and computes a membership from raw chat and score events. Nothing surfaces it. The overlay never mentions membership, the bot never greets anyone, and the page a chatter would land on shows four numbers scoped to a hard-coded community plus a claim button, replacing the whole channel page.

The measurements that shaped this design, taken from the live database:

- 148 memberships, 147 with at least one message; only 4 members have claimed an account.
- Recent broadcasts draw 2 to 8 distinct chatters, of whom 0 to 5 are new to the community.
- Nightbot holds a membership with 75 messages, because every VidsBot line is delivered through the Nightbot account and is therefore stored under Nightbot's YouTube identity.
- Two test channels hold memberships.
- One person (Lehmo) already holds two channels and two memberships: a YouTube chatter channel and an account channel, unlinked.
- YouTube chat accepts 200 characters per message and sends are spaced about 5.2 seconds apart.
- Links are clickable in YouTube chat when the `https://` scheme is present; the owner verified this directly.

## Goals / Non-Goals

**Goals:**

- Close one loop end to end: see the member count on stream, chat, get greeted, follow a link, land on a page showing standing within the community.
- Make the member count truthful and stable, so it can be shown on stream without caveat.
- Guarantee a membership exists before the greeting that references it is composed.
- Lay a badge foundation that later conditions can use without a migration.

**Non-Goals:**

- Holding a site membership pending a YouTube declaration. Site chat is about 2.5% of all chat, so the duplicate it prevents is nearly theoretical today.
- The claim pathway across sign-up, including the case where the code is posted from a different YouTube account.
- Automatic badge evaluation, and the Regular and Squad badges.
- The custom text overlay element, leaderboard periods, the floating live player, and per-membership routes.

## Decisions

### Greeting is composed in the dispatcher tick, not in the chat poll

The chat poll ingests messages one at a time and must not stall; composing a returning chatter's greeting may require an AI call. Onboarding therefore records that a chatter is awaiting a greeting, and the existing dispatcher tick — which already runs commands, moments, TTS and highlight scoring — drains the queue.

This placement also produces the burst rule for free: the tick sees everyone waiting at once, so it can count them and decide between individual greetings and one combined message.

*Alternative considered:* greeting inline in the chat poll. Rejected because an AI call inside the poll delays ingestion of every subsequent message.

### Whether a chatter has been greeted is stored, not held in memory

A new table keyed on (stream, channel) with a uniqueness constraint records each greeting. The insert happens before the send, so a duplicate insert failing is what prevents a second greeting.

*Alternative considered:* an in-memory set, like the existing onboarding guard. Rejected because a worker restart mid-broadcast would re-greet everyone who chats again, and restarts do happen.

### The personal link carries the community as a query parameter, not a fragment

The link is `https://vids.tube/<handle>?c=<communitySlug>`. A fragment (`#c=...`) is the more idiomatic anchor, but a fragment is the part of a URL most likely to be dropped by a linkifier, and the link's whole purpose is to survive YouTube's rendering intact. A query parameter is unambiguously part of the URL.

The parameter names the community whose membership should be highlighted and scrolled to.

### The member count is defined once, in the database

A SQL function returns a community's member count: memberships in that community whose channel carries a YouTube identity and is not marked as software. The overlay, the community section and the greeting all call it, so the number on stream and the number on the page cannot disagree.

This definition is stable across an identity merge. Before a merge, the YouTube-backed channel counts and the account-only channel does not; after it, the survivor carries the YouTube identity and the retired membership is gone. The total is unchanged either way.

*Alternatives considered:* counting every membership (drops by one on each claim); counting a linked member as two (inflates); a monotonic high-water mark (lies).

### Software is an explicit marker, never inferred

RigBot, in the live data, turned out to be a real viewer with one message reading "hii". Any rule that inferred bot-ness from a name would have deleted a real person's membership. The marker is a boolean on the channel, set by the service role, applied to Nightbot only.

### A tombstone chain is forbidden by a trigger, not a check constraint

A check constraint cannot look at another row, so the rule "a merge target may not itself be retired" needs a trigger that raises on insert or update of the tombstone pointer.

*Alternative considered:* teaching every lookup to follow the chain. Rejected because the rule then lives at every call site and can be forgotten at a new one, whereas the trigger cannot.

### A chatter still awaiting profile enrichment gets the shared address instead of a personal link

When the broadcast runs with deferred enrichment, a new chatter's handle is guessed from their display name and rewritten later by the enrichment run — which would break a link already posted in chat. Rather than post a link that will rot, the greeting for such a chatter names the fixed address and omits the personal link.

With the existing "Fetch chatter profiles immediately" setting on, which is the default, this path is never taken.

*Alternative considered:* keeping old handles alive as redirects. Better, but a larger change than this one, and unnecessary while the setting is on.

### Rank is computed in the database

A member's rank within a community is their position by lifetime XP. Computing it in the client would mean fetching every membership. A SQL function returns rank for one membership, and the leaderboard query returns the top members with their rank already assigned.

### The overlay layout version is bumped

The members box takes the subs box's place in a fixed set of positioned boxes. Bumping the saved layout version makes older layouts fall back to default positions, rather than the members box silently inheriting coordinates chosen for a differently shaped box.

## Risks / Trade-offs

- **A greeting arrives before the chatter's membership is written** → onboarding computes the membership on every first message of a broadcast, and the greeting is queued from that same step, so the ordering is guaranteed rather than assumed.
- **Greetings crowd out real chat** → recent broadcasts draw 2 to 8 chatters, so 8 greetings cost about 42 seconds spread across hours. The burst valve covers the broadcast that unexpectedly draws hundreds.
- **An AI call per returning chatter is slow and costly** → the greeting reuses the profile cache that already backs `!me`, which regenerates only after 20 new messages, a changed broadcast count, or a new broadcast.
- **The query parameter is dropped by YouTube's linkifier** → the page renders correctly without it; only the highlight and scroll are lost, and with one community there is nothing to scroll past. Worth checking on the first broadcast.
- **Day One is awarded to a channel later found to be software** → awards are rows and can be deleted; the script is idempotent and re-runnable after the marker is corrected.
- **Marking Nightbot as software hides real bot messages from chat history** → the marker governs counts, leaderboards and awards only; chat history and replay are untouched.
- **Lehmo remains two entries on the leaderboard until they link** → the count already excludes the duplicate; the leaderboard duplicate is accepted until the pending-membership ticket lands.

## Migration Plan

- Add the software marker to channels, defaulting to false; mark Nightbot.
- Add the badge definition and award tables with public read and service-role write.
- Add the greeting record table.
- Add the member-count and rank functions.
- Add the trigger forbidding a merge into a retired channel.
- Run the test-channel removal script.
- Run the Day One award script, with the cutoff set to the change date.
- Bump the overlay layout version and replace the subs box with the members box.

Rollback: every table added here is additive and unread by existing code paths, so reverting the worker and web changes restores the prior behaviour without a data migration. The overlay layout version bump costs the owner one re-positioning of the boxes if rolled back.

## Open Questions

None blocking. Two to confirm during the first broadcast after release:

- Whether the query parameter survives YouTube's link rendering.
- Whether the greeting cadence feels right at the observed chatter volume, or wants a longer gap between sends.
