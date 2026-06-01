insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'channel-assets',
  'channel-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "channel owners can insert branding"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'channel-assets'
    and ((storage.foldername(name))[1])::uuid in (
      select id from public.channels where owner_user_id = (select auth.uid())
    )
  );

create policy "channel owners can update branding"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'channel-assets'
    and ((storage.foldername(name))[1])::uuid in (
      select id from public.channels where owner_user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'channel-assets'
    and ((storage.foldername(name))[1])::uuid in (
      select id from public.channels where owner_user_id = (select auth.uid())
    )
  );

create policy "channel owners can delete branding"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'channel-assets'
    and ((storage.foldername(name))[1])::uuid in (
      select id from public.channels where owner_user_id = (select auth.uid())
    )
  );
