-- Reserve the channel handle atomically when a user signs up. The handle is
-- read from the pending_handle metadata set by the signup form. If it is taken
-- or malformed, the channels constraint fails and the whole auth.users insert
-- rolls back, so signup errors and no orphan user is left behind.
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
  values (new.id, v_handle, v_handle, '@' || v_handle);
  return new;
end;
$$;

drop trigger if exists reserve_handle_after_user_insert on auth.users;
create trigger reserve_handle_after_user_insert
  after insert on auth.users
  for each row
  execute function public.reserve_handle_on_signup();

-- Delete unconfirmed users once the confirmation link has expired
-- (mailer_otp_exp = 1 hour). The channels FK cascades, freeing the handle, so
-- an abandoned signup releases its reserved handle for someone else.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-unconfirmed-users') then
    perform cron.unschedule('delete-unconfirmed-users');
  end if;
end
$$;

select cron.schedule(
  'delete-unconfirmed-users',
  '*/15 * * * *',
  $$delete from auth.users where email_confirmed_at is null and created_at < now() - interval '1 hour'$$
);
