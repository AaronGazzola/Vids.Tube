create policy "channel owners can read their own processing videos"
  on public.videos
  for select
  to authenticated
  using (
    status in ('processing', 'failed')
    and exists (
      select 1 from public.channels c
      where c.id = videos.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  );
