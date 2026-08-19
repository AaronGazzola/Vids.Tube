-- The overlay draws the task list, so the overlay has to be able to read it.
--
-- The same reasoning as the greetings policy: while the broadcast is live the
-- list is going on screen in front of the audience, so it is not private, and
-- reading it with the service role would move the authorization out of the
-- database and into one TypeScript function. Once the broadcast is no longer
-- live the window closes again and only the owner can read it, which is what
-- keeps a draft list on an unstarted broadcast out of public view.
--
-- Writing is untouched: an owner writes their own task versions and nobody
-- else does.
create policy "task versions on a live broadcast are readable"
  on public.stream_task_versions
  for select
  using (
    exists (
      select 1
        from public.streams s
       where s.id = stream_task_versions.stream_id
         and s.status = 'live'
    )
  );
