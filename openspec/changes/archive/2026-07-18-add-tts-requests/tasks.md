## 1. Data model

- [x] 1.1 Migration `add_tts_requests`: `tts_requests` per design.md with RLS
  (owner select all; anon select approved/played only); `chat_scoring_state`
  gains `tts_mode text not null default 'suggest' check in (suggest, auto)`;
  seed the `tts` registry row (cooldown 180, max_per_stream 5, sort_order 30);
  create the public `tts` storage bucket
- [x] 1.2 Push migration + regen types

## 2. Worker

- [x] 2.1 `worker/lib/tts.ts`: `ttsHandler(ctx)` (200-char arg validation with
  explanatory reply; Claude moderation verdict; insert
  suggested/approved/dismissed row; ack replies per mode; silent on dismissed),
  `moderateTtsText(text)` exported for scripts, `synthesizePendingTts()` (each
  pass: approved rows with null audio_path → ElevenLabs mp3 → upload to `tts`
  bucket → set audio_path; missing ELEVENLABS_API_KEY logs one skip),
  `synthesizeTts(text)` with injectable fetch for tests
- [x] 2.2 Register `tts` in `BUILTIN_HANDLERS`; call `synthesizePendingTts()`
  once per scoring pass in `worker/jobs/score.ts`

## 3. Mode switch + owner panel

- [x] 3.1 `broadcast.actions.ts` + `page.tsx` + `settings-tab.tsx`: `ttsMode:
  "suggest" | "auto"` through StreamSettings/StreamSettingsInput/SettingsForm
  (read/write `chat_scoring_state.tts_mode`), plus an "Auto-TTS (vs suggest)"
  SwitchRow in the Mod bot section
- [x] 3.2 `app/(app)/live/page.actions.ts`: `getTtsFeedAction(streamId)` (owner;
  suggested + approved + played, newest first, limit 30),
  `approveTtsAction(id)` (suggested→approved + approved_at),
  `dismissTtsAction(id)` (suggested→dismissed)
- [x] 3.3 `app/(app)/live/page.hooks.tsx`: `useTtsFeed` (5s poll),
  `useApproveTts`, `useDismissTts` (invalidate feed)
- [x] 3.4 `app/(app)/live/panels.tsx`: collapsible "TTS requests" panel above
  the mod bot actions — suggested rows (author, text, moderation reason,
  Approve/Dismiss), then recent approved/played rows with status badges;
  rendered in `ActivityContent`

## 4. Overlay playback

- [x] 4.1 `app/(overlay)/overlay/[channelSlug]/page.actions.ts`:
  `getPlayableTtsAction(channelSlug)` (approved rows with audio for the
  channel's active stream, approval order),
  `markTtsPlayedAction(id)` (approved→played only)
- [x] 4.2 Overlay page: `TtsPlayer` component — polls every 2s, plays one row's
  storage-public mp3 at a time via `<audio>`, renders the message in the
  highlight-card style while playing, marks played on ended/error

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 5.2 `scripts/verify-tts.ts` (guarded, remote db): seed scheduled stream +
  scoring (suggest mode); run the worker; post a clean `!tts hello there
  friends` → assert a `suggested` row with reason + an executed command event
  with the awaiting-approval ack; post an abusive `!tts` → assert `dismissed`
  row and no reply; post a 250-char `!tts` → assert no row and the limit reply;
  flip `tts_mode` to auto, post another clean request next pass → assert
  `approved`; with no ElevenLabs key assert rows stay approved with null
  audio_path and the skip is logged; approve-path action check via direct
  status flip; cleanup
- [x] 5.3 e2e (`tests/e2e/tts.spec.ts`): seed a live stream + suggested row →
  owner Activity tab shows the TTS panel with the text/reason and Approve
  works (row flips approved, panel updates); seed an approved row with a tiny
  real mp3 uploaded to the `tts` bucket → the overlay page plays it (audio
  element appears with the message) and the row flips `played` without replay
- [x] 5.4 `npx openspec validate add-tts-requests --strict`
