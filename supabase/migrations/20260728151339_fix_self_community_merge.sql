-- Fix: a channel is never a member of its own community. When the streamer
-- claims their own YouTube identity (survivor == community), recompute must
-- no-op and the merge must not carry a self-membership, otherwise the
-- memberships check (channel_id <> community_channel_id) aborts the merge.

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

  with ordered as (
    select s.id,
           row_number() over (order by s.started_at, s.id) as rn,
           (mss.stream_id is not null) as attended
      from public.streams s
      left join public.membership_stream_stats mss
        on mss.stream_id = s.id and mss.membership_id = v_membership_id
     where s.channel_id = p_community_channel_id
       and s.status = 'ended'
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

create or replace function public.merge_youtube_identity(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ycid text;
  v_verified timestamptz;
  v_survivor uuid;
  v_source uuid;
  v_conflict uuid;
  v_yt_key text;
  v_user_key text;
  v_communities int := 0;
  r record;
  v_existing_id uuid;
  v_existing_created timestamptz;
begin
  select youtube_channel_id, verified_at
    into v_ycid, v_verified
    from public.youtube_links
   where user_id = p_user_id;
  if v_ycid is null or v_verified is null then
    return jsonb_build_object('merged', false, 'reason', 'link not verified');
  end if;
  v_yt_key := 'youtube:' || v_ycid;
  v_user_key := p_user_id::text;

  select id into v_survivor
    from public.channels
   where owner_user_id = p_user_id
   order by created_at asc
   limit 1;
  if v_survivor is null then
    return jsonb_build_object('merged', false, 'reason', 'no channel for user');
  end if;

  select id into v_conflict
    from public.channels
   where youtube_channel_id = v_ycid
     and owner_user_id is not null
     and owner_user_id <> p_user_id
   limit 1;
  if v_conflict is not null then
    return jsonb_build_object('merged', false, 'reason', 'youtube identity already claimed');
  end if;

  select id into v_source
    from public.channels
   where youtube_channel_id = v_ycid
     and owner_user_id is null
     and merged_into_channel_id is null
   limit 1;

  update public.chat_messages
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;
  update public.score_events
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;
  update public.featured_messages
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;

  for r in
    select distinct stream_id
      from public.viewer_scores
     where participant_key in (v_yt_key, v_user_key)
  loop
    delete from public.viewer_scores
     where stream_id = r.stream_id
       and participant_key in (v_yt_key, v_user_key);

    insert into public.viewer_scores
      (stream_id, user_id, origin, external_author_id,
       total_score, features_count, last_featured_at, author_name, author_avatar_url)
    select
      r.stream_id,
      p_user_id,
      'vidstube',
      null,
      coalesce((select sum(se.points)
                  from public.score_events se
                 where se.stream_id = r.stream_id and se.user_id = p_user_id), 0),
      coalesce((select count(*)
                  from public.featured_messages fm
                 where fm.stream_id = r.stream_id and fm.user_id = p_user_id), 0),
      (select max(fm.featured_at)
         from public.featured_messages fm
        where fm.stream_id = r.stream_id and fm.user_id = p_user_id),
      (select fm.author_name
         from public.featured_messages fm
        where fm.stream_id = r.stream_id and fm.user_id = p_user_id
        order by fm.featured_at desc nulls last
        limit 1),
      (select fm.author_avatar_url
         from public.featured_messages fm
        where fm.stream_id = r.stream_id and fm.user_id = p_user_id
        order by fm.featured_at desc nulls last
        limit 1)
    where exists (
      select 1 from public.score_events se
       where se.stream_id = r.stream_id and se.user_id = p_user_id
    ) or exists (
      select 1 from public.featured_messages fm
       where fm.stream_id = r.stream_id and fm.user_id = p_user_id
    );
  end loop;

  update public.command_events set participant_key = v_user_key where participant_key = v_yt_key;
  update public.tts_requests   set participant_key = v_user_key where participant_key = v_yt_key;
  update public.ask_requests   set participant_key = v_user_key where participant_key = v_yt_key;
  update public.clip_markers   set participant_key = v_user_key where participant_key = v_yt_key;

  for r in
    select id, channel_id, created_at
      from public.banned_participants
     where participant_key = v_yt_key
  loop
    select id, created_at
      into v_existing_id, v_existing_created
      from public.banned_participants
     where channel_id = r.channel_id and participant_key = v_user_key;
    if v_existing_id is null then
      update public.banned_participants
         set participant_key = v_user_key, user_id = p_user_id, origin = 'vidstube'
       where id = r.id;
    elsif r.created_at < v_existing_created then
      delete from public.banned_participants where id = v_existing_id;
      update public.banned_participants
         set participant_key = v_user_key, user_id = p_user_id, origin = 'vidstube'
       where id = r.id;
    else
      delete from public.banned_participants where id = r.id;
    end if;
  end loop;

  if v_source is not null then
    -- A channel is never a member of its own community, so never carry a
    -- self-membership onto the survivor.
    insert into public.memberships
      (channel_id, community_channel_id, credits, rewards)
    select v_survivor, src.community_channel_id, src.credits, src.rewards
      from public.memberships src
     where src.channel_id = v_source
       and src.community_channel_id <> v_survivor
    on conflict (channel_id, community_channel_id) do update
      set credits = public.memberships.credits + excluded.credits,
          rewards = public.memberships.rewards || excluded.rewards,
          updated_at = now();

    delete from public.memberships where channel_id = v_source;
  end if;

  for r in
    select community from (
      select distinct s.channel_id as community
        from public.streams s
        join public.chat_messages cm on cm.stream_id = s.id
       where cm.user_id = p_user_id
          or (cm.origin = 'youtube' and cm.external_author_id = v_ycid)
      union
      select distinct community_channel_id as community
        from public.memberships
       where channel_id = v_survivor
    ) x
    where community <> v_survivor
  loop
    perform public.recompute_membership(v_survivor, r.community);
    v_communities := v_communities + 1;
  end loop;

  if v_source is not null then
    update public.channels
       set youtube_channel_id = null,
           merged_into_channel_id = v_survivor
     where id = v_source;
  end if;
  update public.channels
     set youtube_channel_id = v_ycid
   where id = v_survivor;

  return jsonb_build_object('merged', true, 'communities', v_communities);
end;
$$;

revoke execute on function public.recompute_membership(uuid, uuid) from anon, authenticated;
revoke execute on function public.merge_youtube_identity(uuid) from anon, authenticated;
