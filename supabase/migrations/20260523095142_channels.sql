create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index channels_owner_user_id_idx on public.channels (owner_user_id);

alter table public.channels enable row level security;

create policy "channels are publicly readable"
  on public.channels
  for select
  using (true);

create policy "users can create their own channel"
  on public.channels
  for insert
  to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "users can update their own channel"
  on public.channels
  for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy "users can delete their own channel"
  on public.channels
  for delete
  to authenticated
  using (owner_user_id = (select auth.uid()));
