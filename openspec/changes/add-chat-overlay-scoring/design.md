## Context

Vids.Tube already has the live primitives this builds on: `chat_messages`
(realtime-published, publicly readable), `streams` (`status` `live`/`preview`/…),
and `channels` (per-user `handle` + `avatar_path`, one channel per `auth.users`
row). Identity for any chat author is resolved by `resolveAuthorIdentities`
(`lib/author-identity.ts`); avatars by `channelAssetUrl` (`lib/storage.ts`).
Realtime is consumed via the `useLiveChat` pattern. The studio area is
owner-guarded by `useRequireOwner()`.

This change is **foundation only**: the schema, the overlay that displays featured
messages, and the studio toggle. The scoring engine is a separate, out-of-process
**local bot** (AZ-112) that uses the Claude subscription via `claude -p` and writes
these tables — so this change contains no LLM code and no API key.

## Goals / Non-Goals

**Goals:**
- Persist a game-extensible scoring model (append-only `score_events` + materialized
  `viewer_scores` + a `featured_messages` queue).
- Animate featured authors' avatars across an OBS overlay with growing rings.
- Let the owner toggle scoring on/off and copy the OBS URL from studio.

**Non-Goals:**
- The scoring engine + stream transcription (external bot, AZ-112).
- The public score record (AZ-113), avatar competition (AZ-114), subtitles
  (AZ-115/116), and betting/bonsai/keyboard games (AZ-107).
- Any Anthropic SDK / API key / scoring route in the app.
- Moderation, multi-channel, or changes to existing chat/stream/ingest behavior.

## Decisions

- **Four new tables, public-read / service-write.** `featured_messages`
  (realtime-published), `viewer_scores` (pk `(stream_id,user_id)`; `features_count`
  = ring count), `score_events` (append-only; `type`+`points`+`metadata jsonb`),
  `chat_scoring_state` (pk `stream_id`; `enabled` flag, `last_scored_at` cursor,
  `locked_until` mutex). RLS: `select using (true)`; **no** insert/update policies,
  so only the secret-key client (the external bot) writes. Mirrors the
  `chat_messages`/`streams` migration style (FKs `on delete cascade`, composite
  indexes, `alter publication supabase_realtime add table public.featured_messages`).
- **`ring_level` is snapshotted onto `featured_messages`.** The bot writes
  `ring_level = viewer_scores.features_count` at feature time, so the overlay draws
  the right number of rings from the realtime payload alone — no extra join.
- **Scoring is external and gated by `enabled`.** The local bot (AZ-112) reads
  `chat_scoring_state.enabled` to decide whether to feature messages and owns the
  cursor/lock. This change defines the schema, the read/display path, and the owner
  toggle — nothing that calls an LLM. Rationale: the subscription `claude -p` must
  run locally; keeping the app key-free keeps it deployable.
- **Overlay is a display-only transparent route.** The repo keeps its single required
  root `app/layout.tsx` (moving every existing route into a group to get a second root
  layout would be a broad, regression-prone refactor), so `app/(overlay)/layout.tsx` is
  a nested client layout that sets `<html>/<body>` background transparent while mounted,
  and the root layout's `<Nav>`/`<Toaster>` are gated off for `/overlay/*` via
  `components/site-chrome.tsx`. `Providers` (react-query + realtime) is inherited from the
  root layout. `app/(overlay)/overlay/[channelSlug]/page.tsx`
  resolves channel→live stream (`useChannel`+`useLiveStream`), subscribes via a new
  `useFeaturedMessages(streamId)` hook (mirrors `useLiveChat`, channel
  `featured:${streamId}`), and renders `components/overlay/featured-avatar.tsx`: the
  avatar (`channelAssetUrl` + initials fallback, reusing `AuthorChip` logic) traveling
  across screen via CSS keyframes with `ring_level` rings, queued so they don't overlap.
- **Studio control toggles + displays; it does not score.** `/studio/overlay` writes
  `chat_scoring_state.enabled`, shows the OBS URL, and renders a `viewer_scores`
  leaderboard. No interval driver, no scoring route.

## Risks / Trade-offs

- [Overlay shows nothing until the bot (AZ-112) runs] → Expected; the foundation is
  verified by manually inserting `featured_messages` rows and confirming the overlay
  animates and the leaderboard reflects `viewer_scores`.
- [`enabled` is advisory] → It gates the external bot by convention; the app does not
  enforce scoring. Acceptable — the bot is the only writer.
- [Spec breadth — three capabilities in one change] → They are one coherent display
  foundation (schema → overlay → control); each capability spec stays small.
