## 1. Migration + helpers

- [ ] 1.1 Create the migration via `npx supabase migration new add_channel_remote_avatar` adding `channels.remote_avatar_path text` (nullable). Push with `npx supabase db push` and regenerate `supabase/types.ts`.
- [ ] 1.2 Add `fetchChannelSnippets(ids: string[])` to `lib/youtube.ts`: chunk ids into groups of 50, call `channels.list?part=snippet`, return `{ channelId, title, customUrl, avatarUrl }[]` where `avatarUrl` is the highest-res `snippet.thumbnails` entry.
- [ ] 1.3 Add a pure `upscaleGgphtAvatar(url)` (in `lib/youtube.ts` or a small `lib/avatar.ts`) rewriting a trailing `=s<NN>-c` to `=s800-c` only for `yt3.ggpht.com` URLs; add a unit test covering the s64→s800 rewrite and the non-ggpht passthrough.
- [ ] 1.4 Add `channelAvatarUrl(channel)` to `lib/storage.ts` with precedence `avatar_path` (via `channelAssetUrl`) → `remote_avatar_path` (via `vodAssetUrl`) → null.

## 2. Unclaimed-channel creation job

- [ ] 2.1 Create `scripts/create-unclaimed-channels.ts` (service role, env/client pattern of `scripts/import-youtube-vods.ts`). Guard: abort with a clear message if `channels.youtube_channel_id`, `memberships`, or `recompute_membership` are absent. Resolve the owner community as the earliest-created channel.
- [ ] 2.2 Implement handle generation: normalize YouTube handle/customUrl (fallback `author_name`) to `^[a-z0-9_]{3,30}$` per the `add_channel_handle` migration rules, reject reserved words (reuse the existing reserved set), and resolve case-insensitive collisions with a truncating numeric suffix loop.
- [ ] 2.3 For each `chatter_stats` row lacking a channel for its `author_channel_id`: insert the unclaimed channel (`owner_user_id` null, `youtube_channel_id`, `name`, `handle`), then batch-fetch snippets via `fetchChannelSnippets`, download each avatar, `uploadToR2("avatars/<id>.jpg", bytes, "image/jpeg")`, and set `remote_avatar_path`. Skip existing rows (idempotent).
- [ ] 2.4 After each insert, call `supabaseAdmin.rpc("recompute_membership", { p_channel_id, p_community_channel_id: ownerCommunity })`. Log a per-channel summary line. Run the job once.

## 3. Public unclaimed profile + claim flow

- [ ] 3.1 In `app/[channelSlug]/page.actions.ts` `getChannelBySlugAction` (and the channel hook), select `owner_user_id`, `youtube_channel_id`, `remote_avatar_path`, `merged_into_channel_id`; expose whether the channel is unclaimed, and fetch its owner-community membership stats (message_count, streams_attended, first/last seen).
- [ ] 3.2 In `components/channel-view.tsx`, relax `canView` to also allow unclaimed (ownerless, non-tombstone) channels, and add an unclaimed-profile branch: avatar (via `channelAvatarUrl`) + name + `@handle` + stats strip, no videos/live/description/AI-bio, plus a "Claim this profile" button. Keep the existing claimed non-owner privacy (regression scenario).
- [ ] 3.3 Wire "Claim this profile": unauthenticated → sign-in route; authenticated → deep link to the account YouTube-link card. Reuse existing account plumbing (`saveYoutubeLinkAction` etc.); add no new claim action.

## 4. Worker prompts + claim-time avatar refresh

- [ ] 4.1 In `worker/lib/me-command.ts` `meHandler`, append a claim prompt to the reply when the resolved identity is unclaimed (channel `owner_user_id` null / no verified link), referencing the channel handle URL; suppress it once claimed.
- [ ] 4.2 Apply `upscaleGgphtAvatar` where a live YouTube avatar is first captured (worker chat ingest / me-command display) so not-yet-cached chatters render at higher resolution.
- [ ] 4.3 After a successful `merge_youtube_identity` (AZ-169 verification path in `worker/lib/verify-links.ts`), best-effort re-fetch and re-cache the survivor's avatar to R2 and update `remote_avatar_path`; log and continue on failure.

## 5. Verification + close-out

- [ ] 5.1 `npm run build` + e2e; add/adjust a test asserting an unclaimed channel page renders publicly with stats and the claim CTA, and that a non-owner claimed channel still returns not-found.
- [ ] 5.2 Create a Linear verification issue in the Az team / Vids.Tube project: "Verify: unclaimed channels populated + high-res avatars render in OBS overlay and on profiles after the creation job" and link it to AZ-170.
