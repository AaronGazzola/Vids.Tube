-- A broadcast's task list, stored as whole saved versions rather than as rows
-- per task.
--
-- Every surface that edits the list edits a draft and commits it with one
-- press, so a task is never written on its own. Storing the whole list per save
-- makes the history the VOD needs fall out of the same rows: the list at a
-- playback position is the newest version at or before it, and the overlay's
-- before-and-after is two consecutive versions. A task table plus a status
-- history table would need a trigger to keep the two consistent, and a join to
-- answer the same question.
--
-- Append-only: a version is never edited or deleted, and a correction is
-- another version.
create table public.stream_task_versions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  -- [{ id, text, status }] in list order. `id` is minted in the browser when
  -- the row is added, and is what lets the overlay match a task across two
  -- versions so that reworded text is not read as a removal plus an addition.
  items jsonb not null default '[]'::jsonb,
  -- 'saved' is a change to the list. 'requested' is the owner asking for the
  -- list to be shown again, unchanged. Both are versions so the overlay has one
  -- thing to watch.
  reason text not null default 'saved' check (reason in ('saved', 'requested')),
  created_at timestamptz not null default now()
);

-- Every read is "the newest version of this broadcast".
create index stream_task_versions_stream_created_idx
  on public.stream_task_versions (stream_id, created_at desc);

alter table public.stream_task_versions enable row level security;

create policy "owners read their task versions"
  on public.stream_task_versions
  for select
  using (
    exists (
      select 1
        from public.channels c
       where c.id = stream_task_versions.channel_id
         and c.owner_user_id = auth.uid()
    )
  );

create policy "owners write their task versions"
  on public.stream_task_versions
  for insert
  with check (
    exists (
      select 1
        from public.channels c
       where c.id = stream_task_versions.channel_id
         and c.owner_user_id = auth.uid()
    )
  );

-- Deliberately no update and no delete policy: the table is append-only, and a
-- mistake is corrected by saving again.
