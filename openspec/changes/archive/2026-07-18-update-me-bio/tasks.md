## 1. Worker

- [x] 1.1 `worker/lib/me-command.ts`: `gatherRecentMessages(identity)` — up to
  8 most-recent `chat_messages` bodies for the identity (`user_id` match, or
  `origin='youtube'` + `external_author_id` match) and up to 8 most-recent
  `youtube_chat_archive` messages by `author_channel_id`, each clipped to 120
  chars, newest first.
- [x] 1.2 `buildMePrompt`: third-person instruction using the display name
  ("<name> has been part of the community since…" register), includes the
  sampled messages under a "Things they've said recently" section, and asks
  for a playful nod to what they talk about, still ≤350 chars requested.
- [x] 1.3 `needsRegeneration(snapshot, current, generatedAt, streamStartedAt)`
  adds the per-stream rule: regenerate when `generatedAt` is null/older than
  `streamStartedAt`; existing 20-message and attended-count deltas unchanged.
  `meHandler` reads the engaged stream's `started_at ?? created_at` (via
  `ctx`) and the cached `generated_at` to feed it.

## 2. Verify

- [x] 2.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run` clean;
  `tests/unit/me-command.test.ts` (new): per-stream invalidation boundary
  (older-than-start regenerates, newer does not), delta rules preserved,
  clip-to-120 sampling shape — pure-function tests.
- [x] 2.2 Real regeneration: rerun `scripts/verify-me-command.ts` phases (or a
  targeted run) so a REAL bio is generated with the new prompt; confirm the
  stored profile is third person (does not start with "You") and cites the
  display name.
- [x] 2.3 `npx openspec validate update-me-bio --strict`.
