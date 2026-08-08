-- Badges are definitions plus awards. Nothing here encodes a condition, so a
-- badge may later be granted by a script, by an evaluator running after each
-- membership recompute, or by hand, without a further migration.

create table if not exists public.badges (
  key text primary key,
  title text not null,
  description text not null,
  criteria text not null,
  icon text,
  created_at timestamptz not null default now()
);

-- Awards hang off the membership, not the channel, so a badge earned in one
-- community never shows up in another.
create table if not exists public.membership_badges (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  badge_key text not null references public.badges (key) on delete cascade,
  awarded_at timestamptz not null default now(),
  note text,
  unique (membership_id, badge_key)
);

-- (membership_id, badge_key) covers lookups by membership; badge_key needs its
-- own index for the reverse direction and for the cascade.
create index if not exists membership_badges_badge_key_idx
  on public.membership_badges (badge_key);

alter table public.badges enable row level security;
alter table public.membership_badges enable row level security;

drop policy if exists "badges are publicly readable" on public.badges;
create policy "badges are publicly readable"
  on public.badges
  for select
  using (true);

drop policy if exists "badge awards are publicly readable" on public.membership_badges;
create policy "badge awards are publicly readable"
  on public.membership_badges
  for select
  using (true);

-- No insert/update/delete policies: awards are written by the service role only.

insert into public.badges (key, title, description, criteria, icon)
values (
  'day-one',
  'Day One',
  'Here before memberships existed.',
  'Held a membership in this community before 8 August 2026.',
  'sunrise'
)
on conflict (key) do nothing;
