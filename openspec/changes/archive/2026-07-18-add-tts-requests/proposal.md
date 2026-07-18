## Why

`!tts` lets viewers pay attention into the stream: a moderated message spoken
over the broadcast audio and shown on the highlight overlay. Audio reaches the
stream through the overlay browser source (OBS mixes browser-source audio), so
the owner's mic-only encoder setup and private music stay untouched.

## What Changes

- **`tts_requests`** table: text, requester identity/origin, status
  (`suggested`/`approved`/`dismissed`/`played`), moderation reason, `audio_path`,
  timestamps. Registry seed: `tts` builtin — cooldown 180s, 5 per user per
  stream, 200-char argument limit.
- **`tts_mode`** (`suggest`/`auto`) on `chat_scoring_state`, a "Auto-TTS (vs
  suggest)" switch in Settings riding the one-save form. Auto never means
  unmoderated: every request passes an AI moderation check first; auto only
  skips the owner's click for requests that pass.
- **Worker `!tts` handler**: validates length, runs a Claude moderation verdict
  (speakable-on-stream yes/no + reason); failing requests are `dismissed`
  silently; passing requests become `approved` (auto) or `suggested` (suggest)
  and the requester gets an ack reply.
- **Synthesis** (worker, each pass): `approved` rows without audio are
  synthesized via ElevenLabs (`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` in
  Doppler; missing key logs a skip and leaves rows pending) and uploaded to a
  public `tts` storage bucket.
- **Activity-tab TTS panel** mirroring the mod-bot pattern: suggested rows with
  text + reason + Approve/Dismiss; approved/played history visible.
- **Overlay playback**: the highlight overlay page polls approved rows with
  audio, plays them serially through the browser source (heard on stream via
  OBS; the owner monitors via Monitor-and-Output), shows the message in the
  highlight style while playing, and marks rows `played`.

## Capabilities

### New Capabilities

- `tts-requests`: the request lifecycle, moderation gate, mode switch,
  synthesis, owner panel, and overlay playback.

## Non-goals / Related

- ElevenLabs account/key setup and the OBS audio walkthrough are owner actions
  (tracked outside tasks); until the key exists synthesis skips gracefully.
- Filtering TTS audio back out of whisper transcripts is a deferred Linear item.

## Impact

- Migration: `tts_requests`, `chat_scoring_state.tts_mode`, `tts` seed, public
  `tts` storage bucket + types regen.
- `worker/lib/tts.ts` (handler, moderation prompt, ElevenLabs synthesis,
  pending-synthesis pass) wired into `commands.ts`/`score.ts`.
- Settings switch + form plumbing; Activity-tab panel
  (`page.actions.ts`/`page.hooks.tsx`/`panels.tsx`); overlay playback in
  `app/(overlay)/overlay/[channelSlug]/`.
- `scripts/verify-tts.ts`, e2e for panel + overlay playback.
