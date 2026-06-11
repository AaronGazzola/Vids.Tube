-- Enumeration-safe signup helper: report whether an email is a new, unconfirmed,
-- or confirmed account. SECURITY DEFINER so it can read auth.users; execute is
-- revoked from anon/authenticated so only the service-role (server action) can
-- call it, keeping the existence check off the browser.
create or replace function public.email_signup_status(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from auth.users where lower(email) = lower(p_email)
    ) then 'none'
    when (
      select email_confirmed_at
      from auth.users
      where lower(email) = lower(p_email)
      limit 1
    ) is null then 'unconfirmed'
    else 'confirmed'
  end;
$$;

revoke all on function public.email_signup_status(text) from public;
revoke all on function public.email_signup_status(text) from anon;
revoke all on function public.email_signup_status(text) from authenticated;
