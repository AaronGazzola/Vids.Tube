## 1. Database foundation

- [x] 1.1 Add migration `add_software_channel_marker`: `channels.is_software boolean not null default false`; no new RLS policy needed since channel writes are already owner-only, but confirm the existing owner-update policy cannot set it (add a column-level revoke for `anon`/`authenticated` if it can).
- [x] 1.2 In the same migration, set `is_software = true` for the channel whose `youtube_channel_id` is `UCSvjQBDgYDB5TGVmCZObcwA` (Nightbot).
- [x] 1.3 Add migration `add_membership_badges`: `badges (key text primary key, title text not null, description text not null, criteria text not null, icon text, created_at timestamptz default now())` and `membership_badges (id uuid pk, membership_id uuid references memberships on delete cascade, badge_key text references badges, awarded_at timestamptz not null default now(), note text, unique (membership_id, badge_key))`. Enable RLS on both with a public `select using (true)` policy and no insert/update policies.
- [x] 1.4 In the same migration, insert the `day-one` badge definition with its title, description and criteria text.
- [x] 1.5 Add migration `add_stream_greetings`: `stream_greetings (stream_id uuid references streams on delete cascade, channel_id uuid references channels on delete cascade, greeted_at timestamptz not null default now(), kind text not null check (kind in ('new','returning','batch')), primary key (stream_id, channel_id))`. RLS on, service-role write only, no public select.
- [x] 1.6 Add migration `add_member_count_and_rank`: `community_member_count(p_community uuid) returns int` counting memberships in that community joined to `channels` where `youtube_channel_id is not null and is_software = false`; and `membership_rank(p_membership uuid) returns int` returning the 1-based position by `lifetime_xp desc` among the same filtered set. Both `security definer`, `search_path = public`, granted to `anon`/`authenticated`.
- [x] 1.7 In the same migration, add an index on `memberships (community_channel_id, lifetime_xp desc)` to back the leaderboard and rank queries.
- [x] 1.8 Add migration `forbid_tombstone_chain`: a `before insert or update of merged_into_channel_id on channels` trigger that raises when the target row's own `merged_into_channel_id` is not null.
- [x] 1.9 Run `npx supabase db push`, then regenerate `supabase/types.ts` with `npm run db:types`.

## 2. Data cleanup and the Day One award

- [x] 2.1 Write `scripts/remove-test-channels.ts` that deletes the channels handled `test` and `test4` together with their memberships and membership stream stats, dry-run by default and writing only with `--apply`, printing what it will remove.
- [x] 2.2 Run the removal script with `--apply` and record the resulting member count.
- [x] 2.3 Write `scripts/award-day-one.ts` that awards `day-one` to every membership in the owner community whose channel carries a YouTube identity, is not software, and whose membership `created_at` is before a cutoff constant set to the change date; idempotent via the uniqueness constraint, dry-run by default, writing only with `--apply`.
- [x] 2.4 Run the award script with `--apply` and confirm the awarded count matches the member count from 2.2.

## 3. Worker: membership on every first message

- [x] 3.1 In `worker/lib/chatter-onboarding.ts`, change `ensureChatterChannel` so the early return for an existing channel still calls `recompute_membership` for that channel and the broadcast community before returning, so a chatter new to this community gets a membership without waiting for scoring.
- [x] 3.2 Have `ensureChatterChannel` return whether the channel was newly created alongside the channel id, so the greeting step can tell a first-timer from a returning chatter without a second query.
- [x] 3.3 In `worker/jobs/score.ts`, skip onboarding entirely for a channel marked as software, alongside the existing host and bot skips.

## 4. Worker: the greeting

- [x] 4.1 Add `worker/lib/chatter-greeting.ts` exporting a pure `buildNewMemberGreeting(name, handle, communitySlug, memberNumber)` and `buildReturningGreeting(name, handle, communitySlug, profileLine)`, both producing a single `https://vids.tube/<handle>?c=<communitySlug>` link and staying within the 200-character YouTube limit.
- [x] 4.2 Add `buildBatchGreeting(names, memberCount)` to the same module, naming the waiting chatters together with the bare `vids.tube/...` address and no personal link.
- [x] 4.3 Add `queueGreeting(streamId, channelId, kind)` writing to `stream_greetings`, treating a uniqueness violation as "already greeted" and returning false so no send happens.
- [x] 4.4 In `worker/jobs/score.ts`, record a chatter as pending a greeting at the point onboarding runs for their first message of the broadcast, holding the resolved channel id, display name and whether they were newly created.
- [x] 4.5 Add a `runChatterGreetings(stream, channelId)` step to the dispatcher tick that drains the pending list: 5 or fewer sends one greeting each; more than 5 sends one combined message and records a `batch` greeting for each named chatter.
- [x] 4.6 For a returning chatter, source the personal line from the existing `me_profiles` cache via the `!me` generation path in `worker/lib/me-command.ts`, reusing its regeneration rules rather than adding a second generator.
- [x] 4.7 When the resolved channel is still `awaiting_enrichment`, omit the personal link and name the bare `vids.tube/...` address instead, so a handle about to be rewritten is never published.
- [x] 4.8 Skip the greeting for the host, for software channels, and for banned participants, reusing the existing host and ban checks.
- [x] 4.9 Gate the returning-chatter greeting on a new `chat_scoring_state.greet_returning` boolean defaulting to true, read once per tick.

## 5. Worker: the me command link

- [x] 5.1 In `worker/lib/me-command.ts`, change `unclaimedClaimNudge` to emit `https://vids.tube/<handle>?c=<communitySlug>` instead of the current bare `vids.tube/<handle>`, threading the community slug through from the command context.

## 6. Overlay: the members box

- [x] 6.1 In `app/(app)/live/demo.types.ts`, replace the `goalSubs` box key with `members`, bump `DEMO_LAYOUT_VERSION` to 3, and give the members box a default position, scale, opacity and label.
- [x] 6.2 Add `components/overlay/member-count-strip.tsx` rendering the member total and the call to action naming `vids.tube/...` as a thin horizontal strip about 810px wide (three quarters of the 1080 canvas) and compact in height, with the count and call to action arranged along its length; follow the existing `box-frame.tsx` and `goal-bar.tsx` conventions.
- [x] 6.3 Add `getMemberCountAction(channelSlug)` to `app/(overlay)/overlay/[channelSlug]/page.actions.ts` calling `community_member_count`, and a `useMemberCount` hook polling it on the same cadence the other overlay boxes use.
- [x] 6.4 Render the members box in `app/(overlay)/overlay/[channelSlug]/page.tsx` at its saved position, and remove the subs goal box from that render.
- [x] 6.5 Update `app/(app)/live/overlay-editor.tsx` box keys, dimensions and toggle list so the members box is draggable, resizable, toggleable and opacity-adjustable, and the subs goal box is gone.
- [x] 6.6 Remove the subs entry from `OVERLAY_BASE_DIMS` and any subs-specific goal rendering in the main overlay, leaving the likes and viewers goals untouched.

## 7. Live settings

- [x] 7.1 Add a "Welcome returning chatters" switch to the bot section of `app/(app)/live/settings-tab.tsx`, wired to a `setGreetReturningAction` in `app/(app)/live/page.actions.ts` writing `chat_scoring_state.greet_returning`.

## 8. Web: memberships section

- [x] 8.1 Add `getChannelMembershipsAction(channelId)` to `app/[channelSlug]/page.actions.ts` returning every membership that channel holds, each with the host community's slug, name and avatar, whether that community is currently live, the member's rank from `membership_rank`, and the badges awarded on that membership.
- [x] 8.2 Add a `useChannelMemberships(channelId)` hook in `app/[channelSlug]/page.hooks.tsx`.
- [x] 8.3 Add `components/membership-card.tsx` showing the community avatar and name, a live marker, level, rank, lifetime XP, messages, broadcasts attended, current and best streak, badges, and a control leading to that community. One shape for every member: a new member's card carries zeroes in the same fields, with "just joined" in place of the rank while lifetime XP is zero, and no substitute content.
- [x] 8.4 Add `components/memberships-section.tsx` rendering the cards with live communities first and inline skeletons while loading, returning null when the channel holds no memberships so no empty state or container is drawn.
- [x] 8.5 Read the `?c=` parameter in the section, highlight the matching card, and scroll to it in an effect that runs after the membership list resolves; do nothing when the parameter names a community the channel has no membership in.
- [x] 8.6 Add `components/badge-chip.tsx` rendering one badge with its title and description available on hover and focus.

## 9. Web: community section

- [x] 9.1 Add `getChannelCommunityAction(channelId, page)` to `app/[channelSlug]/page.actions.ts` returning the member count from `community_member_count` and a page of members ordered by lifetime XP with avatar, name, handle, level, XP and badges, applying the software and YouTube-identity filters.
- [x] 9.2 Add `getLiveChattersAction(streamId)` returning the members who have chatted in the current broadcast, with the same filters.
- [x] 9.3 Add `useChannelCommunity` and `useLiveChatters` hooks in `app/[channelSlug]/page.hooks.tsx`.
- [x] 9.4 Add `components/community-section.tsx` rendering the member total, the current-broadcast chatter list while live, and the leaderboard, each entry linking to that member's channel page with `?c=` set to this community. Open with the first five members and expand a page at a time in place via `useInfiniteQuery`, hiding the expand control once every member is shown.
- [x] 9.5 Render the community section in `components/channel-view.tsx` only when the channel has hosted at least one broadcast, placed below the live-or-upcoming card and above the videos.
- [x] 9.6 Replace the separate chatting-now list with tabs on the community section: all time, latest stream, and now live. The per-broadcast boards read `membership_stream_stats`, ordered by XP earned in that broadcast then by messages sent, so someone who chatted without scoring still appears.
- [x] 9.7 Give the now-live tab a red dot and red outline, offer it only while broadcasting, select it by default unless the reader has chosen a tab, and fall back to all time when a tab stops being available.

## 10. Web: channel page restructure

- [x] 10.1 In `components/channel-view.tsx`, stop replacing the whole page for an unclaimed channel: render the shared identity header, the memberships section, and the claim call to action, and continue to omit videos, live content, description and the AI bio.
- [x] 10.2 Delete `UnclaimedProfile`'s four-number stats strip and `getChannelMembershipStatsAction`, whose single hard-coded community is superseded by the memberships section.
- [x] 10.3 Rework the claim call to action into an unobtrusive strip, rendered only when the channel itself is unclaimed and the viewer is anonymous or signed in without a verified YouTube link; never on a claimed channel, whatever the viewer's state. Word it as a question ("Is this you?") rather than asserting the page belongs to the reader, since anyone can open the link.
- [x] 10.4 Rework `components/channel-claim-hint.tsx` from a bordered panel into the same quiet strip treatment, keeping the verify code, copy and regenerate controls.
- [x] 10.5 Render the memberships section on every channel page, below the community section where one exists.
- [x] 10.6 Omit the videos section entirely on a channel that has published nothing, keeping it for the channel's own owner so it stays clear where uploads land.

## 12. Credits

- [x] 12.1 Include the membership's credit balance in `getChannelMembershipsAction` and show it on the membership card as a stat with a gold coin, dimmed when the balance is nothing.
- [x] 12.2 Quote the balance in the returning-chatter greeting and in the `!me` reply, scoped to the community being chatted in, and say nothing when the balance is nothing.
- [x] 12.3 Remove the three requirements describing credits UI that was never built: the `/credits` page, the account credit summary, and the navigation credits indicator.

## 13. Overlay surface and opacity

- [x] 13.1 Add a shared `overlay-surface` backing whose alpha is its own base multiplied by an `--overlay-bg-opacity` variable, and move the break card, goal ring, speech bubble and members strip onto it.
- [x] 13.2 Have the overlay positioner and the layout preview set `--overlay-bg-opacity` from the saved opacity instead of setting `opacity` on the box, so the control fades the backing and never the text.
- [x] 13.3 Rebuild the members strip: translucent black backing, "Join the chat to become a member" along the left, and the total, "Vids.tube" and "Members" stacked down the right; remove the "See your stats" line.

## 11. Tests

- [x] 11.1 Add vitest coverage for the greeting builders: link form carries `https://` and the `?c=` parameter, every variant stays within 200 characters, and the batch form carries no personal link.
- [x] 11.2 Add vitest coverage for the layout merge at version 3: an older saved layout keeps its toggles and falls back to default positions rather than placing the members box at the subs box's coordinates.
- [x] 11.3 Add `scripts/verify-membership-loop.ts` that asserts against the live database: the member count excludes Nightbot and both test channels; the count is unchanged by a simulated merge; a second `recompute_membership` call leaves totals identical; a duplicate greeting insert is rejected; and a merge into a retired channel is rejected by the trigger.
- [x] 11.4 Add a playwright test covering a chatter channel page: the memberships section renders for an unclaimed channel, the `?c=` parameter highlights the matching card, and the claim strip shows for an anonymous visitor.
- [x] 11.5 Run `npm run lint` and `npm run build` and fix what they report.
