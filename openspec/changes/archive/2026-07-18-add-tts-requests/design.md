## Context

Overlay pages are OBS browser sources and OBS captures browser-source audio
into the stream mix directly, so TTS audio never touches the desktop/encoder
audio path. The mod-bot suggest/approve pattern (status rows + Activity panel +
Settings switch) is the template. The worker already shells to Claude.

## Decisions

- `tts_requests`: id, channel_id, stream_id (cascade), chat_message_id,
  participant_key, origin, author_name, text, status
  (suggested/approved/dismissed/played), reason, audio_path, created_at,
  approved_at, played_at. RLS: owner select; public select of
  approved/played rows only (the overlay is unauthenticated); writes via
  service role and the public mark-played action.
- Moderation: one Claude call per request — verdict JSON {allow, reason} with a
  conservative prompt (block insults, slurs, harassment, doxxing, spam, links,
  political flamebait; allow banter and jokes). Dismissed requests reply
  nothing (no troll feedback loop).
- Synthesis: ElevenLabs POST /v1/text-to-speech/{voice}?output_format=mp3_44100_128
  with model eleven_flash_v2_5; voice from ELEVENLABS_VOICE_ID (default Rachel
  21m00Tcm4TlvDq8ikWAM); upload to storage bucket `tts` (public) at
  `<requestId>.mp3`. The pending-synthesis pass runs each scoring loop pass.
- Overlay: `useTtsQueue` polls approved-with-audio (2s) ordered by approved_at;
  a player component holds an <audio> element, plays one row at a time, shows
  the message in the highlight-card style, and calls `markTtsPlayedAction` on
  ended/error. Public action guarded to only flip approved→played.
- Mode: `chat_scoring_state.tts_mode` default 'suggest'; StreamSettings/
  SettingsForm gain `ttsMode` exactly like `banMode`.
- Registry seed: tts, cooldown 180, max_per_stream 5, sort_order 30.

## Risks / Trade-offs

- Public mark-played action could be abused to skip a queued TTS — impact is a
  skipped audio only; acceptable for v1.
- TTS audio re-enters whisper transcription (accepted; Linear follow-up).
