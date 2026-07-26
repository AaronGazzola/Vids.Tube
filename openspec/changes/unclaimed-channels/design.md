## Context

- After AZ-169, `channels` carries `youtube_channel_id` (unique, nullable), nullable `owner_user_id`, `merged_into_channel_id`, and a `handle` matching `^[a-z0-9_]{3,30}$` (unique, case-insensitive). `memberships`/`membership_stream_stats` hold per-community aggregates via `recompute_membership(channel, community)`.
- `chatter_stats` (145 rows as of 2026-07-25): `author_channel_id` PK, `author_name`, `total_messages`, `videos_attended`, `first_seen_at`, `last_seen_at`. This is the roster of archived chatters.
- Avatars today: `lib/youtube.ts` `fetchLiveChatPage` returns `avatarUrl` from liveChat `profileImageUrl` (a `yt3.ggpht.com/...=s64-c` URL). Stored as `author_avatar_url` on `chat_messages`/`featured_messages`/`viewer_scores` and used by overlays. No channel-level avatar for YouTube identities exists.
- Uploaded channel branding lives in Supabase storage (`channel-assets`, `channels.avatar_path`, rendered by `channelAssetUrl`). Public R2 objects are served via `NEXT_PUBLIC_VOD_BASE_URL` (`vodAssetUrl(path)`), and `lib/r2.ts uploadToR2(key, body, contentType)` writes to `R2_BUCKET_VOD`.
- `components/channel-view.tsx` gates viewing with `canView = isPlatformOwnerChannel || isOwner`; anything else renders not-found. The `channels` spec requirement "Publishing and public channel viewing gated to the platform owner" encodes this.

## Goals / Non-Goals

**Goals:**

- One idempotent, re-runnable job that materializes an unclaimed channel for every archived chatter and populates its owner-community membership.
- Durable high-res avatars: batched fetch, R2 cache, uniform render precedence, low-res stopgap.
- Public stats-only profile for unclaimed channels with a claim CTA; `!me` claim nudge.

**Non-Goals:**

- The AZ-168 in-chat verify banner (separate change).
- AI bios, traits, customization for unclaimed channels (claimed-only; AZ-171).
- Google/OAuth linking (AZ-152); claiming here rides the existing verify-code flow + AZ-169 merge.
- Backfilling `author_avatar_url` on historical rows; overlays keep using per-message avatars.

## Decisions

### D1 — Creation job keyed on `chatter_stats`, idempotent by `youtube_channel_id`

`scripts/create-unclaimed-channels.ts` (service role, pattern of `scripts/import-youtube-vods.ts`) iterates `chatter_stats`. For each `author_channel_id` with no existing `channels` row (claimed or unclaimed) holding that `youtube_channel_id`, it inserts one channel: `owner_user_id = null`, `youtube_channel_id = author_channel_id`, `name = author_name` (fallback `"YouTube chatter"`), generated `handle`, then calls `recompute_membership(newChannelId, ownerCommunityId)`. A second run inserts nothing (the `youtube_channel_id` unique constraint + pre-check make it a no-op) but may re-recompute. The owner community is the earliest-created channel (platform owner), matching AZ-169's definition.

Alternative considered: create channels lazily on first profile visit. Rejected: the pull is that the page *already* exists to be discovered/claimed, and the roster is small and known.

### D2 — Handle generation: normalize the YouTube handle, resolve collisions with a suffix

Prefer the chatter's YouTube `customUrl`/handle (from `channels.list` snippet, D4); fall back to `author_name`. Normalize like the existing `add_channel_handle` migration: lowercase, `[^a-z0-9_]`→`_`, collapse, pad to ≥3, truncate to ≤30. Reject reserved words (reuse the existing reserved set). On collision with an existing handle (case-insensitive), append `_2`, `_3`, … (truncating the base so the total stays ≤30) until unique. Handles are permanent identifiers; on claim the user may change theirs through the normal channel-handle path (out of scope here).

### D3 — Public stats-only profile for unclaimed channels

Relax the viewing gate: `canView` becomes true when the channel is the platform owner's, is owned by the viewer, **or is unclaimed** (`owner_user_id` null and not a tombstone). Unclaimed channels render a distinct branch: banner/avatar + name + `@handle`, a stats strip from the owner-community membership (`message_count`, `streams_attended`, `first_seen_at`/`last_seen_at`), NO videos/live/description/AI-bio, and a prominent "Claim this profile" button. The button routes an unauthenticated visitor to sign-in and an authenticated visitor to the account YouTube-link card (deep link), where the existing verify-code flow + AZ-169 merge complete the claim. Merged (tombstone) channels still redirect to their survivor (AZ-169 behavior); they never render this branch.

### D4 — Avatar pipeline: batched fetch → R2 cache → render precedence

`lib/youtube.ts fetchChannelSnippets(ids: string[])` batches up to 50 ids per `channels.list?part=snippet` call (1 quota unit each; ~145 chatters ≈ 3 calls) and returns `{ channelId, title, customUrl, avatarUrl }` where `avatarUrl` is the highest-res `snippet.thumbnails` entry. The creation job fetches the image bytes, uploads them to R2 via `uploadToR2("avatars/<youtube_channel_id>.jpg", bytes, "image/jpeg")`, and stores the relative key in `channels.remote_avatar_path`. `lib/storage.ts channelAvatarUrl(channel)` centralizes precedence: uploaded Supabase `avatar_path` (via `channelAssetUrl`) → `remote_avatar_path` (via `vodAssetUrl`) → null (initials fallback). ChannelView and the overlay author avatar use this helper.

Size-token stopgap: a pure `upscaleGgphtAvatar(url)` rewrites a trailing `=s<NN>-c` to `=s800-c` for `yt3.ggpht.com` URLs, applied where a live `ggpht` avatar is first captured (worker chat ingest / me-command display) so freshly-seen chatters look right before the durable cache runs. R2 URLs rotate-proof; the stopgap is only for not-yet-cached identities.

Alternative considered: store cached avatars in the Supabase `channel-assets` bucket to reuse `avatar_path`. Rejected: the roadmap specifies R2 caching (egress/scale), and `remote_avatar_path` keeps the uploaded-branding path (`avatar_path`) cleanly higher-precedence so a claimed user's own upload always wins.

### D5 — Avatar refresh on claim

The AZ-169 merge is the claim moment. A post-merge hook (worker, after `merge_youtube_identity` succeeds) re-fetches and re-caches the avatar for the survivor's `youtube_channel_id` so the claimed channel holds a fresh durable copy. Best-effort: failure logs and does not block.

### D6 — `!me` claim prompt

`worker/lib/me-command.ts meHandler` appends a short claim nudge to the reply when the resolving identity is unclaimed (a YouTube identity whose `youtube_channel_id` maps to a channel with null `owner_user_id`, or no verified link). The nudge points to the channel URL ("your page's already here: vids.tube/<handle> — sign in there to claim it"). Suppressed once the identity is claimed.

## Risks / Trade-offs

- [Google avatar URLs rotate / thumbnails vary] → cache bytes to R2 at creation and re-cache on claim; never render Google URLs long-term. `channelAvatarUrl` falls back to initials when nothing is cached.
- [Handle collisions across 145 + future chatters] → deterministic suffix loop with truncation guarantees a unique ≤30-char handle; reserved-word set reused so no unclaimed channel squats a route name.
- [Relaxing the viewing gate could expose non-owner claimed channels] → the relaxation is strictly for `owner_user_id IS NULL` non-tombstone rows; claimed non-owner privacy is unchanged and covered by a regression scenario.
- [Job depends on AZ-169 being applied] → the job hard-checks for `memberships`/`recompute_membership` and the `youtube_channel_id` column and aborts with a clear message if AZ-169 has not shipped.
- [Quota] → snippet batch is 1 unit/call (≈3 units total); negligible against the daily quota. Avatar image downloads are plain HTTP GETs, not quota-billed.

## Migration Plan

1. Migration: add `channels.remote_avatar_path text` (nullable). Push, regenerate types.
2. Ship `lib/youtube.ts`/`lib/storage.ts` helpers, ChannelView unclaimed branch, `!me` nudge, claim-time re-cache hook.
3. Run `scripts/create-unclaimed-channels.ts` once against the owner community.
4. Rollback: the column is additive; deleting unclaimed rows (`owner_user_id IS NULL`) and their memberships restores prior state. The viewing-gate relaxation is code-only.

## Open Questions

None blocking. The `=s800-c` target size and the `avatars/<id>.jpg` key layout are fixed here; both are cheap to change with a re-run of the job.
