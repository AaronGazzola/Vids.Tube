-- A community's YouTube account must never also belong to an ownerless chatter
-- profile. That is exactly what happened when the unclaimed-channel job treated
-- the streamer's own account as an ordinary chatter: it created a duplicate
-- public profile holding the streamer's identity, plus a membership in the
-- streamer's own community, which then aborted the identity merge.
--
-- The job now skips those accounts. This is the backstop that makes it
-- impossible rather than merely unlikely.
create or replace function public.block_duplicate_community_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict text;
begin
  if new.youtube_channel_id is null or new.owner_user_id is not null then
    return new;
  end if;

  select c.slug into v_conflict
    from public.channels c
   where c.youtube_channel_id = new.youtube_channel_id
     and c.id <> new.id
     and (
       c.owner_user_id is not null
       or exists (select 1 from public.streams s where s.channel_id = c.id)
     )
   limit 1;

  if v_conflict is not null then
    raise exception
      'youtube account % already belongs to channel @% — an ownerless profile cannot hold a community or claimed identity',
      new.youtube_channel_id, v_conflict
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists channels_block_duplicate_community_identity on public.channels;
create trigger channels_block_duplicate_community_identity
  before insert or update of youtube_channel_id, owner_user_id on public.channels
  for each row
  execute function public.block_duplicate_community_identity();
