-- Historical YouTube VOD transcripts: caption segments per archived VOD,
-- sourced from YouTube's auto-generated captions by the owner-run backfill
-- script. Owner-read only, mirroring youtube_chat_archive.

create table public.youtube_transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.youtube_vods (video_id) on delete cascade,
  start_s double precision not null,
  end_s double precision not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index youtube_transcripts_video_idx
  on public.youtube_transcripts (video_id, start_s);

alter table public.youtube_transcripts enable row level security;

create policy "owners read youtube transcripts"
  on public.youtube_transcripts
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.owner_user_id = auth.uid()
    )
  );
