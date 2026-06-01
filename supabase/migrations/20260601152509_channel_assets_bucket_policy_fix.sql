drop policy if exists "channel owners can insert branding" on storage.objects;
drop policy if exists "channel owners can update branding" on storage.objects;
drop policy if exists "channel owners can delete branding" on storage.objects;

create policy "channel owners can insert branding"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'channel-assets'
    and exists (
      select 1 from public.channels c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_user_id = (select auth.uid())
    )
  );

create policy "channel owners can update branding"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'channel-assets'
    and exists (
      select 1 from public.channels c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'channel-assets'
    and exists (
      select 1 from public.channels c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_user_id = (select auth.uid())
    )
  );

create policy "channel owners can delete branding"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'channel-assets'
    and exists (
      select 1 from public.channels c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_user_id = (select auth.uid())
    )
  );
