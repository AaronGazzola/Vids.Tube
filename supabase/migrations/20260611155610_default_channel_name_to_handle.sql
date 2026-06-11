-- Default a channel's display name to its handle (without the leading "@").
-- The signup reservation trigger previously seeded name = '@' || handle.

create or replace function public.reserve_handle_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
begin
  v_handle := lower(trim(coalesce(new.raw_user_meta_data->>'pending_handle', '')));
  if v_handle = '' then
    return new;
  end if;
  insert into public.channels (owner_user_id, handle, slug, name)
  values (new.id, v_handle, v_handle, v_handle);
  return new;
end;
$$;

-- Backfill existing channels still carrying the default "@handle" display name.
update public.channels
set name = handle
where name = '@' || handle;
