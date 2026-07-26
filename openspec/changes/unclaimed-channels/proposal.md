# Unclaimed channels for archived chatters + high-res avatar pipeline (AZ-170)

## Why

The channel/membership model (AZ-169) makes `channels` the universal identity entity and gives every identity a per-community membership, but nothing yet materializes a channel for the ~145 archived YouTube chatters in `chatter_stats`. The bridge that turns the YouTube back-catalog into claimable identities needs each chatter to have a real, publicly viewable page — "this page already exists and it's you, claim it" is the pull. Overlay avatars are also low-res today (liveChat `profileImageUrl` at `=s64-c`), and Google's avatar URLs rotate, so they must be captured at high resolution and cached durably.

## What Changes

- **Unclaimed channel per archived chatter** — a service-role job creates one `channels` row (`owner_user_id` null, `youtube_channel_id` set) for every `chatter_stats.author_channel_id` that has no channel yet, with a generated unique handle and a name from the chatter's display name. Re-runnable and idempotent.
- **Membership population** — after creating each unclaimed channel, `recompute_membership(channel, ownerCommunity)` runs so the profile shows real stats (messages, streams attended, first/last seen) from the pooled event stream.
- **High-res avatar pipeline** — a new batched YouTube helper (`channels.list?part=snippet`, 50 ids/call, 1 quota unit each) fetches each chatter's high-res thumbnail; images are downloaded and cached to the public R2 bucket under an `avatars/` prefix, and the relative key is stored on `channels`. The immediate `=s64-c`→`=s800-c` size-token rewrite is applied wherever a live `ggpht` avatar is first captured, as a stopgap for freshly-seen chatters.
- **Unclaimed channels are publicly viewable** — **BREAKING** relative to today's gate (only the platform-owner channel is public): an unclaimed channel renders a stats-only profile to anyone, with a "Claim this profile" call to action. Claimed non-owner channels stay private as before.
- **Contextual claim prompts (no `!link` command)** — the unclaimed channel page's "Claim this profile" CTA (sign in → verify code), and a claim nudge appended to `!me` replies for still-unclaimed identities.
- **Avatar caching on claim** — when an identity is claimed and merged, its cached avatar is (re)captured so the claimed channel keeps a durable copy.

## Capabilities

### New Capabilities

- `unclaimed-channels`: creation job, handle generation, membership population, public stats-only profile view, and the "Claim this profile" flow.
- `avatar-pipeline`: batched high-res fetch, size-token rewrite stopgap, R2 caching, storage column, and render precedence.

### Modified Capabilities

- `channels`: unclaimed channels are publicly viewable in a stats-only profile mode; the platform-owner viewing gate is relaxed for ownerless (unclaimed) rows.
- `me-command`: `!me` replies append a contextual claim prompt when the identity is unclaimed.

## Impact

- **Depends on AZ-169** (`channel-membership-model`) being applied: uses `channels.youtube_channel_id`, nullable `owner_user_id`, `memberships`, and `recompute_membership`.
- **Migration**: add `channels.remote_avatar_path text` (relative R2 key, served via `NEXT_PUBLIC_VOD_BASE_URL`).
- **New code**: `scripts/create-unclaimed-channels.ts`; `fetchChannelSnippets(ids[])` + avatar helpers in `lib/youtube.ts`; `channelAvatarUrl(channel)` precedence helper in `lib/storage.ts`.
- **UI**: `components/channel-view.tsx` gains a stats-only unclaimed profile branch + claim CTA; `app/[channelSlug]/page.actions.ts` / channel hooks expose unclaimed rows and membership stats.
- **Worker**: `worker/lib/me-command.ts` appends the claim prompt; avatar capture on first-seen and on claim.
- **Types**: `supabase/types.ts` regeneration.
