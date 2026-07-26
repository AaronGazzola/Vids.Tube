-- AZ-169: channels as the universal identity entity + memberships (channel x
-- community) with aggregates derived from raw events, plus the pooled-history
-- claim/merge. Statements are guarded so a re-push after a fix is safe.

-- 1.1 channels becomes the universal identity entity.
alter table public.channels
  alter column owner_user_id drop not null;

alter table public.channels
  add column if not exists youtube_channel_id text,
  add column if not exists merged_into_channel_id uuid references public.channels (id);

create unique index if not exists channels_youtube_channel_id_key
  on public.channels (youtube_channel_id);

create index if not exists channels_merged_into_idx
  on public.channels (merged_into_channel_id);

alter table public.channels drop constraint if exists channels_identity_check;
alter table public.channels
  add constraint channels_identity_check
  check (
    owner_user_id is not null
    or youtube_channel_id is not null
    or merged_into_channel_id is not null
  );

-- 1.2 memberships + per-stream history.
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  community_channel_id uuid not null references public.channels (id) on delete cascade,
  lifetime_xp bigint not null default 0,
  level int not null default 0,
  credits bigint not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  message_count int not null default 0,
  streams_attended int not null default 0,
  rewards jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, community_channel_id),
  check (channel_id <> community_channel_id)
);

create index if not exists memberships_community_idx
  on public.memberships (community_channel_id);

create table if not exists public.membership_stream_stats (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  xp int not null default 0,
  message_count int not null default 0,
  stream_started_at timestamptz,
  primary key (membership_id, stream_id)
);

-- 1.3 RLS: public read, service-role write only.
alter table public.memberships enable row level security;
alter table public.membership_stream_stats enable row level security;

drop policy if exists "memberships are publicly readable" on public.memberships;
create policy "memberships are publicly readable"
  on public.memberships
  for select
  using (true);

drop policy if exists "membership stream stats are publicly readable" on public.membership_stream_stats;
create policy "membership stream stats are publicly readable"
  on public.membership_stream_stats
  for select
  using (true);

-- 1.4 Level curve. floor(sqrt(xp / 100)): L1 at 100, L2 at 400, L3 at 900.
create or replace function public.level_for_xp(xp bigint)
returns int
language sql
immutable
as $$
  select case
    when xp <= 0 then 0
    else floor(sqrt(xp / 100.0))::int
  end;
$$;

-- 1.5 Deterministic recompute of one membership from raw events.
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

  -- Streaks over the community's ended streams; attendance = a stream-stats row.
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

-- 1.6 Pooled-history claim/merge: re-key raw events onto the survivor and
-- recompute; never combine aggregates (credits summed, rewards unioned only).
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

  -- Re-key raw events (keep origin/external_author_id as provenance).
  update public.chat_messages
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;
  update public.score_events
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;
  update public.featured_messages
     set user_id = p_user_id
   where origin = 'youtube' and external_author_id = v_ycid;

  -- Rebuild viewer_scores per affected stream from events (never update the
  -- generated participant_key in place, and never sum the two aggregate rows).
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

  -- Re-key plain-text participant keys (no unique key on these columns).
  update public.command_events set participant_key = v_user_key where participant_key = v_yt_key;
  update public.tts_requests   set participant_key = v_user_key where participant_key = v_yt_key;
  update public.ask_requests   set participant_key = v_user_key where participant_key = v_yt_key;
  update public.clip_markers   set participant_key = v_user_key where participant_key = v_yt_key;

  -- banned_participants is unique per (channel, participant_key): earliest wins.
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

  -- Memberships: carry source credits/rewards into the survivor, then drop the
  -- source's memberships. recompute (below) preserves credits.
  if v_source is not null then
    insert into public.memberships
      (channel_id, community_channel_id, credits, rewards)
    select v_survivor, src.community_channel_id, src.credits, src.rewards
      from public.memberships src
     where src.channel_id = v_source
    on conflict (channel_id, community_channel_id) do update
      set credits = public.memberships.credits + excluded.credits,
          rewards = public.memberships.rewards || excluded.rewards,
          updated_at = now();

    delete from public.memberships where channel_id = v_source;
  end if;

  -- Recompute the survivor in every community where either identity has history.
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
  loop
    perform public.recompute_membership(v_survivor, r.community);
    v_communities := v_communities + 1;
  end loop;

  -- Move the identity key to the survivor; tombstone the source.
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

-- 1.7 Service-role only.
revoke execute on function public.recompute_membership(uuid, uuid) from anon, authenticated;
revoke execute on function public.merge_youtube_identity(uuid) from anon, authenticated;
