-- Every lookup that resolves a chatter from their YouTube account follows the
-- tombstone pointer exactly once. A two-step chain would resolve to a channel
-- that is itself retired, and the chatter would be treated as brand new, losing
-- their history and their membership.
--
-- Forbidding the chain is preferred over teaching every lookup to follow it:
-- the rule lives in one place and cannot be forgotten at a new call site.

create or replace function public.forbid_tombstone_chain()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.merged_into_channel_id is null then
    return new;
  end if;

  if new.merged_into_channel_id = new.id then
    raise exception 'a channel cannot be merged into itself';
  end if;

  if exists (
    select 1
      from public.channels
     where id = new.merged_into_channel_id
       and merged_into_channel_id is not null
  ) then
    raise exception
      'cannot merge into a channel that is itself merged (would create a tombstone chain)';
  end if;

  if exists (
    select 1
      from public.channels
     where merged_into_channel_id = new.id
  ) then
    raise exception
      'cannot merge a channel that other channels have already been merged into';
  end if;

  return new;
end;
$$;

drop trigger if exists channels_forbid_tombstone_chain on public.channels;
create trigger channels_forbid_tombstone_chain
  before insert or update of merged_into_channel_id on public.channels
  for each row
  execute function public.forbid_tombstone_chain();
