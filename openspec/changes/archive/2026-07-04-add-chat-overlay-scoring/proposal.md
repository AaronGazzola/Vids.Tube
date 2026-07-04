## Why

Live chat scrolls too fast for viewers to feel seen, and there is no on-stream
reward for posting good messages. We want an overlay that highlights the best
chat messages (the "top comment") and celebrates them: the featured author's
channel avatar animates across the screen, gaining one extra concentric ring each
time (a "planet rings" progress motif).

This change is the **foundation only**: the scoring **data model**, the OBS
overlay that **displays** featured messages, and the studio control to turn
featuring on and copy the OBS URL. The scoring **engine is external** — a local
bot (tracked separately as AZ-112) reads chat + the stream transcript and writes
into these tables using the Claude subscription (`claude -p`, no API key). Keeping
the brain out of the app means the deployed app needs no API key, and the scorer
can run locally.

## What Changes

- **New data model** (one migration): `featured_messages` (the featured queue,
  realtime-published), `viewer_scores` (per-stream/per-viewer aggregate; its
  `features_count` is the ring count), `score_events` (append-only log, the seam
  the bot and future games write to), and `chat_scoring_state` (per-stream cursor,
  on/off `enabled` flag, and a lock). All publicly readable, **service-write only**
  — populated by the external bot's service-key client.
- **OBS overlay route**: a transparent `(overlay)` route group (no site chrome) at
  `/overlay/[channelSlug]` that subscribes to `featured_messages` in realtime and
  animates the featured author's avatar across screen with `ring_level` rings.
- **Studio overlay control** (`/studio/overlay`): owner-only toggle for
  `chat_scoring_state.enabled` (the bot reads this flag), the copyable OBS Browser
  Source URL, and a live viewer leaderboard.
- **Out of scope** (separate tickets): the scoring bot + stream transcription
  (AZ-112), the public score record (AZ-113), the avatar competition overlay
  (AZ-114), subtitles (AZ-115/AZ-116), and the betting/bonsai/keyboard games
  (AZ-107). This change writes **no LLM code** and has **no Anthropic dependency**.

## Capabilities

### New Capabilities

- `chat-scoring`: the data model — featured messages, per-viewer scores, the
  append-only event log, and the scoring on/off + cursor state. (Schema only; the
  engine that populates it is external.)
- `featured-overlay`: the transparent OBS overlay that animates featured authors'
  avatars across screen with growing concentric rings.
- `overlay-control`: the studio owner control surface — scoring on/off toggle, OBS
  URL, and leaderboard. It does not run scoring itself.

### Modified Capabilities

(none)

## Impact

- **DB**: one new migration (`npx supabase migration new add_chat_overlay_scoring`);
  `npm run db:types` regenerates `supabase/types.ts`. Adds `featured_messages` to the
  `supabase_realtime` publication.
- **New files**: `app/(overlay)/layout.tsx` + `app/(overlay)/overlay/[channelSlug]/{page.tsx,page.hooks.tsx}`;
  `components/overlay/featured-avatar.tsx`; `app/studio/overlay/{page.tsx,page.hooks.tsx,page.actions.ts}`;
  new types in `app/layout.types.ts`.
- **No** `@anthropic-ai/sdk`, **no** `ANTHROPIC_API_KEY`, **no** scoring API route —
  the external local bot (AZ-112) owns scoring and writes these tables with the
  service key.
- **Reuses** `useChannel`/`useLiveStream`, `resolveAuthorIdentities`/`getAuthorIdentityAction`
  (`lib/author-identity.ts`), `channelAssetUrl` (`lib/storage.ts`), `AuthorChip`
  (`components/author-chip.tsx`), `supabaseAdmin` (`supabase/admin-client.ts`), the
  server client + `useRequireOwner` guard, and the `useLiveChat` realtime pattern.
- No changes to existing chat, streams, or ingest behavior.
