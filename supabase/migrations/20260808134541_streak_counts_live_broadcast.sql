create or replace function public.recompute_membership(
  p_channel_id uuid,
  p_community_channel_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_ycid text;
  v_keys text[];
  v_membership_id uuid;
  v_has_history boolean;
  v_lifetime bigint;
  v_messages int;
  v_attended int;
  v_first timestamptz;
  v_last timestamptz;
  v_current int;
  v_best int;
begin
  if p_channel_id = p_community_channel_id then
    return;
  end if;

  select owner_user_id, youtube_channel_id
    into v_owner, v_ycid
    from public.channels
   where id = p_channel_id;

  v_keys := array_remove(
    array[v_owner::text, case when v_ycid is not null then 'youtube:' || v_ycid end],
    null
  );

  select exists (
    select 1
      from public.chat_messages cm
      join public.streams s on s.id = cm.stream_id and s.channel_id = p_community_channel_id
     where (v_owner is not null and cm.user_id = v_owner)
        or (v_ycid is not null and cm.origin = 'youtube' and cm.external_author_id = v_ycid)
  ) into v_has_history;

  if not v_has_history then
    select id into v_membership_id
      from public.memberships
     where channel_id = p_channel_id
       and community_channel_id = p_community_channel_id;
    if v_membership_id is not null then
      delete from public.membership_stream_stats where membership_id = v_membership_id;
      update public.memberships
         set lifetime_xp = 0,
             level = 0,
             message_count = 0,
             streams_attended = 0,
             current_streak = 0,
             best_streak = 0,
             first_seen_at = null,
             last_seen_at = null,
             updated_at = now()
       where id = v_membership_id;
    end if;
    return;
  end if;

  insert into public.memberships (channel_id, community_channel_id)
  values (p_channel_id, p_community_channel_id)
  on conflict (channel_id, community_channel_id) do nothing;

  select id into v_membership_id
    from public.memberships
   where channel_id = p_channel_id
     and community_channel_id = p_community_channel_id;

  delete from public.membership_stream_stats where membership_id = v_membership_id;

  insert into public.membership_stream_stats
    (membership_id, stream_id, xp, message_count, stream_started_at)
  select
    v_membership_id,
    m.stream_id,
    coalesce(sc.xp, 0),
    m.message_count,
    m.started_at
  from (
    select cm.stream_id,
           s.started_at,
           count(*)::int as message_count
      from public.chat_messages cm
      join public.streams s on s.id = cm.stream_id and s.channel_id = p_community_channel_id
     where (v_owner is not null and cm.user_id = v_owner)
        or (v_ycid is not null and cm.origin = 'youtube' and cm.external_author_id = v_ycid)
     group by cm.stream_id, s.started_at
  ) m
  left join (
    select vs.stream_id,
           greatest(sum(vs.total_score), 0)::int as xp
      from public.viewer_scores vs
     where vs.participant_key = any(v_keys)
     group by vs.stream_id
  ) sc on sc.stream_id = m.stream_id;

  select
    coalesce(sum(xp), 0),
    coalesce(sum(message_count), 0),
    count(*)::int
    into v_lifetime, v_messages, v_attended
    from public.membership_stream_stats
   where membership_id = v_membership_id;

  select min(cm.created_at), max(cm.created_at)
    into v_first, v_last
    from public.chat_messages cm
    join public.streams s on s.id = cm.stream_id and s.channel_id = p_community_channel_id
   where (v_owner is not null and cm.user_id = v_owner)
      or (v_ycid is not null and cm.origin = 'youtube' and cm.external_author_id = v_ycid);

  -- Turning up counts while the broadcast is still running. The timeline was
  -- ended broadcasts only, so a member who was chatting right now read as a
  -- streak of zero until the broadcast ended. A running broadcast joins the
  -- timeline once it has been attended, and stays out of it otherwise, so
  -- nobody's streak is zeroed the moment a broadcast goes live.
  with ordered as (
    select s.id,
           row_number() over (order by s.started_at, s.id) as rn,
           (mss.stream_id is not null) as attended
      from public.streams s
      left join public.membership_stream_stats mss
        on mss.stream_id = s.id and mss.membership_id = v_membership_id
     where s.channel_id = p_community_channel_id
       and (s.status = 'ended' or mss.stream_id is not null)
  ),
  islands as (
    select rn, attended,
           rn - row_number() over (partition by attended order by rn) as grp
      from ordered
  ),
  runs as (
    select grp, attended, count(*)::int as len, max(rn) as max_rn
      from islands
     group by grp, attended
  ),
  maxrn as (select max(rn) as m from ordered)
  select
    coalesce((select len
                from runs, maxrn
               where runs.attended and runs.max_rn = maxrn.m), 0),
    coalesce((select max(len) from runs where attended), 0)
    into v_current, v_best;

  update public.memberships
     set lifetime_xp = v_lifetime,
         level = public.level_for_xp(v_lifetime),
         message_count = v_messages,
         streams_attended = v_attended,
         first_seen_at = v_first,
         last_seen_at = v_last,
         current_streak = v_current,
         best_streak = v_best,
         updated_at = now()
   where id = v_membership_id;
end;
$$;

revoke execute on function public.recompute_membership(uuid, uuid) from anon, authenticated;
