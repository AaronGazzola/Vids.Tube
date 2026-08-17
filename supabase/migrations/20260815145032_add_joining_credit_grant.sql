-- A new membership arrives with something to spend. Until now a first-time
-- chatter started with nothing and had to wait for a scoring pass before any
-- credit existed, so the moment of joining carried no value at all.
--
-- Five, priced against !tts costing one credit: an arriving chatter can be heard
-- five times before earning anything, and a chatter earning at the usual rate of
-- about three credits a broadcast re-earns three uses per stream. Five also sits
-- just below the median balance of nine among members who hold any, so arriving
-- does not outrank months of attendance.

-- Once per membership, for its whole existence, enforced here rather than by a
-- caller remembering to look. Mirrors credit_entries_one_earned_per_membership.
create unique index if not exists credit_entries_one_joined_per_membership
  on public.credit_entries (membership_id)
  where kind = 'joined';

create or replace function public.grant_joining_credits(p_membership_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The amount lives here and nowhere else. Changing it means looking at
  -- chat_commands.credit_cost too: the two were chosen against each other.
  v_amount constant bigint := 5;
  v_channel uuid;
  v_community uuid;
  v_is_software boolean;
begin
  select channel_id, community_channel_id
    into v_channel, v_community
    from public.memberships
   where id = p_membership_id;

  if v_channel is null then
    return 0;
  end if;

  -- The host owns the community rather than belonging to it, so there is no
  -- purse of theirs to fill. Checked in the function rather than in the trigger
  -- so that any future caller inherits the rule.
  if v_channel = v_community then
    return 0;
  end if;

  select is_software into v_is_software
    from public.channels
   where id = v_channel;

  if coalesce(v_is_software, false) then
    return 0;
  end if;

  insert into public.credit_entries (membership_id, amount, kind)
  values (p_membership_id, v_amount, 'joined')
  on conflict do nothing;

  return public.sync_membership_credits(p_membership_id);
end;
$$;

comment on function public.grant_joining_credits(uuid) is
  'Grants a new membership its joining credits, once and never again. Written as a ledger line so verify-credit-ledger still balances and a re-score cannot rewrite it.';

-- recompute_membership inserts the membership with `on conflict do nothing` and
-- never deletes one, so an insert trigger fires exactly once per membership and
-- a rebuild — which only ever updates — cannot fire it again. That is what makes
-- "never on a rebuild" structural rather than a check somebody has to remember.
create or replace function public.membership_joining_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_joining_credits(new.id);
  return new;
end;
$$;

drop trigger if exists memberships_joining_grant on public.memberships;
create trigger memberships_joining_grant
  after insert on public.memberships
  for each row
  execute function public.membership_joining_grant();

-- A routine that hands out credits must not be reachable over the public API.
-- This is the class of hole close_public_routine_access was written to close.
revoke execute on function public.grant_joining_credits(uuid) from anon, authenticated;
revoke execute on function public.membership_joining_grant() from anon, authenticated;

-- Deliberately no backfill. All 147 memberships that exist today joined before
-- the grant did, and paying them retrospectively would move balances the
-- returning-chatter greeting has already been quoting on air. This is a
-- decision, not an oversight.
