-- One definition of "member", used by the overlay, the community section and
-- the greeting, so the number on stream and the number on the page cannot
-- disagree.
--
-- Counting only YouTube-backed memberships is what makes the total stable
-- across an identity claim. Before the merge the YouTube channel counts and the
-- account channel does not; after it the survivor carries the YouTube identity
-- and the losing membership is gone. The total is unchanged either way.

create index if not exists memberships_community_xp_idx
  on public.memberships (community_channel_id, lifetime_xp desc);

create or replace function public.community_member_count(p_community uuid)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int
    from public.memberships m
    join public.channels c on c.id = m.channel_id
   where m.community_channel_id = p_community
     and c.youtube_channel_id is not null
     and c.is_software = false;
$$;

create or replace function public.membership_rank(p_membership uuid)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int + 1
    from public.memberships m
    join public.channels c on c.id = m.channel_id
   where m.community_channel_id = (
           select community_channel_id from public.memberships where id = p_membership
         )
     and c.youtube_channel_id is not null
     and c.is_software = false
     and m.lifetime_xp > (
           select lifetime_xp from public.memberships where id = p_membership
         );
$$;

-- Both run as the caller, and both underlying tables are publicly readable, so
-- no elevated privileges are needed.
grant execute on function public.community_member_count(uuid) to anon, authenticated;
grant execute on function public.membership_rank(uuid) to anon, authenticated;
