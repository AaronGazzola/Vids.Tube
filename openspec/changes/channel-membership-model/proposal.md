# Channel & membership data model + pooled-history merge (AZ-169)

## Why

Vids.Tube's V1 phase ("Identity & the bridge", `docs/roadmap.md`) requires a single identity entity for every account AND every known YouTube chatter, plus a per-community relationship that will carry XP, Level, Credits, and streaks. Today `channels` requires an `auth.users` owner, no membership concept exists, and a verified YouTube link (`youtube_links.verified_at`) changes nothing about historical identity — the chatter's YouTube history and their Vids.Tube account remain two unrelated identities. Every subsequent V1 ticket (AZ-170 unclaimed channels, AZ-168 claim banner, AZ-171 slim `!me`, AZ-172 dossier) keys into this model, so it must land first.

## What Changes

- **`channels` becomes the universal identity entity.** `owner_user_id` becomes nullable; a new unique `youtube_channel_id` column identifies YouTube-native identities; a `merged_into_channel_id` self-reference marks merged (tombstoned) channels so their URLs redirect. A channel row is exactly one of: claimed (has owner), unclaimed (YouTube id only), or merged (tombstone). **BREAKING** for code that assumes `owner_user_id` is non-null.
- **New `memberships` table** — one row per (member channel × community channel) holding the derived aggregates: lifetime XP, Level, Credits balance, current/best streak, first/last seen, message count, streams attended, rewards. All values scoped to the community; Credits never transfer between communities.
- **New `membership_stream_stats` table** — the per-stream XP/attendance history behind each membership; this timeline is what streaks and lifetime XP are recomputed from.
- **Deterministic recompute** — a single recompute routine derives a membership (and its stream stats) entirely from raw events (`chat_messages`, `viewer_scores`/`score_events`); aggregates are never hand-edited, except Credits which are a spendable balance (ledger arrives in V3).
- **Pooled-history merge on claim** — when a YouTube link verifies, the YouTube identity's raw events are re-keyed onto the surviving (user's) channel and ALL aggregates are recomputed from the pooled event stream. Aggregates are never merged directly. Collision rules (both identities active in the same community, same stream, or both banned) are specified precisely.
- **Backfill** — memberships created for the existing owner community from already-captured history (verified linked users; unclaimed-channel mass creation stays in AZ-170).

## Capabilities

### New Capabilities

- `memberships`: the channel × community relationship — schema, derived aggregates, XP/Level/streak definitions, recompute semantics, RLS.
- `identity-merge`: claim-time pooled-history merge — trigger point, which tables re-key, collision rules, tombstoning, idempotency.

### Modified Capabilities

- `channels`: channel rows no longer require an owner; claimed/unclaimed/merged states, `youtube_channel_id` identity key, tombstone redirect behavior, RLS for unclaimed rows.
- `youtube-handle-link`: successful verification now triggers the identity merge (previously it only set `verified_at`).

## Impact

- **Migrations**: alter `channels`; create `memberships`, `membership_stream_stats`; create `level_for_xp` + recompute + merge functions.
- **Worker**: `worker/lib/verify-links.ts` invokes the merge after flipping `verified_at`.
- **Raw-event tables re-keyed on merge**: `chat_messages`, `score_events`, `viewer_scores` (rebuilt), `featured_messages`, `command_events`, `tts_requests`, `ask_requests`, `clip_markers`, `banned_participants`.
- **Untouched**: `youtube_chat_archive`, `chatter_stats`, `youtube_vods` (archive stays keyed by `author_channel_id`; linkage now flows through `channels.youtube_channel_id`).
- **Types**: `supabase/types.ts` regeneration; no UI in this change (consumers arrive in AZ-170..174).
