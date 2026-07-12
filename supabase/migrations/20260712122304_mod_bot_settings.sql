-- Mod bot settings surfaced as switches on the /live Settings tab:
--   highlighting_enabled  — the bot features standout messages (leaderboard/overlay)
--   auto_display_featured — featured messages auto-promote to the overlay
-- (scoring on/off is the existing `enabled`; ban mode is `moderation_mode`.)

alter table public.chat_scoring_state
  add column if not exists highlighting_enabled boolean not null default true,
  add column if not exists auto_display_featured boolean not null default false;
