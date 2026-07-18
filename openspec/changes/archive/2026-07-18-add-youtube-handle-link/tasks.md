## 1. Data model

- [x] 1.1 Migration `add_youtube_links`: `youtube_links` (user_id uuid pk →
  auth.users cascade, youtube_channel_id text not null, youtube_handle text not
  null, verify_code text not null, verified_at timestamptz, created_at/updated_at
  defaults; index on youtube_channel_id); RLS: select own row
  (`user_id = auth.uid()`), no client writes
- [x] 1.2 Push migration + regen `supabase/types.ts`

## 2. Resolution + actions

- [x] 2.1 `lib/youtube.ts`: `fetchChannelByHandle(handle)` —
  `channels.list?part=snippet&forHandle=<handle-without-@>` with
  `YOUTUBE_API_KEY`; returns `{ channelId, handle (snippet.customUrl or typed),
  title }` or null when no items
- [x] 2.2 `app/(app)/account/page.actions.ts`: `getYoutubeLinkAction()` (own row
  or null), `saveYoutubeLinkAction(handle)` (auth-checked; trim/strip `@`;
  resolve via 2.1 — expected error "handle not found" when null; upsert own row
  with new 6-char A–Z/2–9 code, `verified_at: null`),
  `regenerateYoutubeCodeAction()` (new code, keeps channel),
  `unlinkYoutubeAction()` (delete own row) — all via `supabaseAdmin` after
  `auth.getUser()`
- [x] 2.3 `app/(app)/account/page.hooks.tsx`: `useYoutubeLink`,
  `useSaveYoutubeLink`, `useRegenerateYoutubeCode`, `useUnlinkYoutube`
  (mutations unwrap `ActionResult`, invalidate the link query)

## 3. Account card

- [x] 3.1 `app/(app)/account/page.tsx`: "YouTube account" card — handle input +
  Save; when linked: resolved handle/title, then either the unverified block
  (instructions + `verify_code` in a copyable code element, "New code" button)
  or a Verified badge with the verified date; Unlink with confirm; inline
  loading skeleton for the link query only

## 4. Worker verification matcher

- [x] 4.1 `worker/lib/verify-links.ts`: `processLinkVerifications(batch)` — for
  YouTube-origin messages whose trimmed body is a 6-char code format, look up
  unverified `youtube_links` rows matching `verify_code = body` AND
  `youtube_channel_id = externalAuthorId`, set `verified_at = now()`; exported
  for direct script testing
- [x] 4.2 Wire into `worker/jobs/score.ts` right before `processCommands` (runs
  on the same ban-filtered batch; verification messages still flow onward as
  normal chat)

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build`,
  `npx vitest run` clean
- [x] 5.2 `scripts/verify-youtube-link.ts`: resolves a known real handle via
  `fetchChannelByHandle` (asserts channel id shape `UC…`); seeds a
  `youtube_links` row for the owner user with a code; calls
  `processLinkVerifications` with a synthetic YouTube-origin message from the
  claimed channel id → asserts `verified_at` set; resets, calls with a
  different author id → asserts still unverified; cleanup
- [x] 5.3 e2e (`tests/e2e/youtube-link.spec.ts`): owner signs in, `/account`
  shows the YouTube card; saving `@YouTube` resolves and shows the code block;
  Unlink removes it (cleanup deletes the row regardless)
- [x] 5.4 `npx openspec validate add-youtube-handle-link --strict`
