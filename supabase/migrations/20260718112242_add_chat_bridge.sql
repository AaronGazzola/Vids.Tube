alter table public.chat_scoring_state
  add column bridge_enabled boolean not null default true;
