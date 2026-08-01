# avatar-pipeline Specification

## Purpose
TBD - created by archiving change unclaimed-channels. Update Purpose after archive.
## Requirements
### Requirement: Batched high-res snippet fetch

The system SHALL provide `fetchChannelSnippets(ids)` in `lib/youtube.ts` that fetches YouTube channel snippets via `channels.list?part=snippet`, batching at most 50 ids per request, and returns for each id its title, canonical handle/customUrl, and the highest-resolution thumbnail URL available.

#### Scenario: Many ids fetched in few calls

- **WHEN** `fetchChannelSnippets` is called with 145 channel ids
- **THEN** it issues 3 requests (50 + 50 + 45) and returns a high-res thumbnail URL for each resolvable id

### Requirement: Durable R2 avatar cache

The system SHALL download each fetched avatar image and upload the bytes to the public R2 bucket under `avatars/<youtube_channel_id>.jpg`, storing the relative key in `channels.remote_avatar_path`. Cached avatars SHALL be served via the public R2 base URL and SHALL NOT depend on Google's rotating URLs at render time.

#### Scenario: Avatar cached at channel creation

- **WHEN** an unclaimed channel is created and its avatar fetched
- **THEN** the image is stored in R2 under `avatars/<youtube_channel_id>.jpg` and `channels.remote_avatar_path` holds that key

### Requirement: Avatar re-cache on claim

When an identity is claimed and merged (AZ-169), the system SHALL best-effort re-fetch and re-cache the avatar for the survivor's `youtube_channel_id`; a failure SHALL be logged and SHALL NOT block the merge or chat processing.

#### Scenario: Fresh copy captured on claim

- **WHEN** a user completes a claim that merges a YouTube identity
- **THEN** the avatar for that `youtube_channel_id` is re-fetched and re-cached to R2

### Requirement: Render precedence helper

The system SHALL provide `channelAvatarUrl(channel)` in `lib/storage.ts` resolving a channel's avatar in precedence order: an uploaded Supabase branding avatar (`avatar_path` via `channelAssetUrl`), then the cached remote avatar (`remote_avatar_path` via `vodAssetUrl`), then null (initials fallback). Channel and overlay avatar rendering SHALL use this helper.

#### Scenario: Uploaded avatar wins over cached

- **WHEN** a claimed channel has both an uploaded `avatar_path` and a `remote_avatar_path`
- **THEN** `channelAvatarUrl` returns the uploaded Supabase URL

#### Scenario: Unclaimed channel uses cached avatar

- **WHEN** an unclaimed channel has only `remote_avatar_path`
- **THEN** `channelAvatarUrl` returns the R2 URL

### Requirement: Size-token upscale stopgap

The system SHALL provide a pure `upscaleGgphtAvatar(url)` that rewrites a trailing `=s<NN>-c` size token to `=s800-c` for `yt3.ggpht.com` avatar URLs and returns other URLs unchanged, applied where a live YouTube avatar is first captured so not-yet-cached chatters render at higher resolution.

#### Scenario: Low-res token upscaled

- **WHEN** `upscaleGgphtAvatar` receives a `yt3.ggpht.com/...=s64-c` URL
- **THEN** it returns the same URL with `=s800-c`

#### Scenario: Non-ggpht URL untouched

- **WHEN** `upscaleGgphtAvatar` receives a non-`ggpht` URL
- **THEN** it returns the URL unchanged

