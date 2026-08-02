-- Credits become a ledger. Earnings are one line per membership, rewritten from
-- lifetime XP on every recompute; spends are separate lines recompute never
-- touches. That split is what lets a re-score rebuild every credit earned
-- without refunding or confiscating a credit already spent.

create table if not exists public.credit_entries (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  amount bigint not null,
  kind text not null,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_entries_membership_idx
  on public.credit_entries (membership_id);

create unique index if not exists credit_entries_one_earned_per_membership
  on public.credit_entries (membership_id)
  where kind = 'earned';

alter table public.credit_entries enable row level security;

drop policy if exists "credit entries are publicly readable" on public.credit_entries;
create policy "credit entries are publicly readable"
  on public.credit_entries
  for select
  using (true);

revoke insert, update, delete on public.credit_entries from anon, authenticated;

-- The earning rate lives here and nowhere else: changing it is this line plus a
-- recompute of every membership.
create or replace function public.credits_for_xp(xp bigint)
returns bigint
language sql
immutable
as $$
  select greatest(floor(coalesce(xp, 0) / 10.0), 0)::bigint;
$$;

create or replace function public.membership_credit_balance(p_membership_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(amount), 0)::bigint
    from public.credit_entries
   where membership_id = p_membership_id;
$$;

create or replace function public.sync_membership_credits(p_membership_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  v_balance := public.membership_credit_balance(p_membership_id);
  update public.memberships
     set credits = v_balance,
         updated_at = now()
   where id = p_membership_id;
  return v_balance;
end;
$$;

create or replace function public.write_earned_credits(p_membership_id uuid, p_xp bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount bigint;
begin
  v_amount := public.credits_for_xp(p_xp);
  insert into public.credit_entries (membership_id, amount, kind)
  values (p_membership_id, v_amount, 'earned')
  on conflict (membership_id) where kind = 'earned'
  do update set amount = excluded.amount, updated_at = now();
  return public.sync_membership_credits(p_membership_id);
end;
$$;

create or replace function public.spend_credits(
  p_membership_id uuid,
  p_amount bigint,
  p_kind text,
  p_source_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('spent', false, 'reason', 'invalid amount');
  end if;
  if p_kind is null or p_kind = 'earned' then
    return jsonb_build_object('spent', false, 'reason', 'invalid kind');
  end if;

  select public.membership_credit_balance(p_membership_id) into v_balance;
  if v_balance < p_amount then
    return jsonb_build_object('spent', false, 'reason', 'insufficient', 'balance', v_balance);
  end if;

  insert into public.credit_entries (membership_id, amount, kind, source_id)
  values (p_membership_id, -p_amount, p_kind, p_source_id);

  return jsonb_build_object('spent', true, 'balance', public.sync_membership_credits(p_membership_id));
end;
$$;

revoke execute on function public.sync_membership_credits(uuid) from anon, authenticated;
revoke execute on function public.write_earned_credits(uuid, bigint) from anon, authenticated;
revoke execute on function public.spend_credits(uuid, bigint, text, text) from anon, authenticated;

-- How much is fetched when a previously unknown chatter first speaks.
alter table public.channels
  add column if not exists chatter_enrichment_mode text not null default 'full',
  add column if not exists awaiting_enrichment boolean not null default false;

alter table public.channels drop constraint if exists channels_chatter_enrichment_mode_check;
alter table public.channels
  add constraint channels_chatter_enrichment_mode_check
  check (chatter_enrichment_mode in ('full', 'deferred'));

create index if not exists channels_awaiting_enrichment_idx
  on public.channels (awaiting_enrichment)
  where awaiting_enrichment;

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
      (channel_id, community_channel_id, rewards)
    select v_survivor, src.community_channel_id, src.rewards
      from public.memberships src
     where src.channel_id = v_source
       and src.community_channel_id <> v_survivor
    on conflict (channel_id, community_channel_id) do update
      set rewards = public.memberships.rewards || excluded.rewards,
          updated_at = now();

    -- Credits are not summed. Spending lines move to the survivor; the earning
    -- line is re-derived from pooled XP by the recompute below, so a merged
    -- identity is never credited twice for the same history.
    update public.credit_entries ce
       set membership_id = dst.id,
           updated_at = now()
      from public.memberships src
      join public.memberships dst
        on dst.channel_id = v_survivor
       and dst.community_channel_id = src.community_channel_id
     where ce.membership_id = src.id
       and src.channel_id = v_source
       and ce.kind <> 'earned';

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

revoke execute on function public.merge_youtube_identity(uuid) from anon, authenticated;

-- Rather than replacing recompute_membership wholesale, the earning line is kept
-- in step by a trigger on lifetime_xp. Any path that changes a membership's XP
-- therefore keeps its credits correct, and there is no second copy of the
-- recompute body to drift.
create or replace function public.membership_credits_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_earned_credits(new.id, new.lifetime_xp);
  return null;
end;
$$;

drop trigger if exists memberships_sync_earned_credits_ins on public.memberships;
create trigger memberships_sync_earned_credits_ins
  after insert on public.memberships
  for each row
  execute function public.membership_credits_sync();

drop trigger if exists memberships_sync_earned_credits_upd on public.memberships;
create trigger memberships_sync_earned_credits_upd
  after update of lifetime_xp on public.memberships
  for each row
  execute function public.membership_credits_sync();
