-- Per-stream command exclusion plus the live-stats builtins.

alter table public.streams
  add column if not exists disabled_commands text[] not null default '{}';

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, v.keyword, 'builtin', v.keyword, v.description, 60, v.sort_order
from public.channels c
cross join (
  values
    ('rank', 'Your position and points on this stream''s leaderboard', 20),
    ('top', 'The top three chatters right now', 21),
    ('goal', 'Progress on the stream''s subs, likes, and viewers goals', 22),
    ('uptime', 'How long the stream has been live', 23)
) as v (keyword, description, sort_order)
on conflict (channel_id, keyword) do nothing;
