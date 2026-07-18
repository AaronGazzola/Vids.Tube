-- Cached !me bios: one row per chatter identity with the stats snapshot the
-- bio was generated from, so Claude runs only when a chatter's stats move.

create table public.me_profiles (
  profile_key text primary key,
  profile text not null,
  snapshot jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.me_profiles enable row level security;

create policy "owners read me profiles"
  on public.me_profiles
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.owner_user_id = auth.uid()
    )
  );

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, 'me', 'builtin', 'me',
  'A quick AI summary of your history on this channel', 600, 10
from public.channels c
on conflict (channel_id, keyword) do nothing;
