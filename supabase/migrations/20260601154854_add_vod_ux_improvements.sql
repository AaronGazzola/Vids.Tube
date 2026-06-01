alter table public.videos
  add column width integer,
  add column height integer,
  add column preview_paths text[] not null default '{}';

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index comments_video_created_idx
  on public.comments (video_id, created_at desc);
create index comments_user_idx on public.comments (user_id);

create table public.comment_votes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_votes_user_idx on public.comment_votes (user_id);

alter table public.comments enable row level security;
alter table public.comment_votes enable row level security;

create policy "comments are publicly readable"
  on public.comments
  for select
  using (true);

create policy "authenticated users can post comments as themselves"
  on public.comments
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "authors can update their own comments"
  on public.comments
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "authors can delete their own comments"
  on public.comments
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "comment votes are publicly readable"
  on public.comment_votes
  for select
  using (true);

create policy "authenticated users can vote as themselves"
  on public.comment_votes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "voters can change their own vote"
  on public.comment_votes
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "voters can remove their own vote"
  on public.comment_votes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
