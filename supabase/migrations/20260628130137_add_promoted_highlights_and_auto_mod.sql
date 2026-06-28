-- Click-to-promote highlights: the overlay shows only messages the owner promotes.
alter table public.featured_messages
  add column if not exists promoted_at timestamptz;

-- Auto-hide is the default moderation mode for new streams.
alter table public.chat_scoring_state
  alter column moderation_mode set default 'auto';
