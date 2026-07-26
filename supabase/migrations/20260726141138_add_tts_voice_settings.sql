-- ElevenLabs voice settings for !tts, owner-tunable from /live Settings.
-- Explicit values instead of API defaults: flash v2.5 with no voice_settings
-- produces unstable prosody (drawn-out final syllables) on short inputs.

alter table public.chat_scoring_state
  add column if not exists tts_stability numeric not null default 0.5
    check (tts_stability >= 0 and tts_stability <= 1),
  add column if not exists tts_similarity numeric not null default 0.75
    check (tts_similarity >= 0 and tts_similarity <= 1);
