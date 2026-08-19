-- What the host needs to remember about one chatter, so a conversation can be
-- picked up where it was left.
--
-- Keyed by membership rather than by channel, because everything a chatter is
-- to a community is scoped to that community and nothing about them transfers
-- between communities. One row per person per community, replaced whole.
--
-- Deliberately not `me_profiles`. That is a warm public bio the `!me` command
-- reads aloud in chat. This is private, owner-read only, and is a synthesis of
-- things people said in public — which is exactly why it must never be shown
-- back to the person it describes.
create table public.chatter_notes (
  membership_id uuid primary key
    references public.memberships (id) on delete cascade,
  -- [{ text, kind, raised_at }] where `kind` is 'standing' (durable: what they
  -- study, what work they do) or 'checkin' (has a shelf life and invites a
  -- question next time: an illness, an exam, a birthday). `raised_at` is the
  -- date it was said in chat, so a stale check-in can be dropped rather than
  -- asked about months late.
  notes jsonb not null default '[]'::jsonb,
  -- { message_count, streams_attended } as they stood when these notes were
  -- written. A membership whose snapshot has not moved is skipped without a
  -- model call, the same test `me_profiles` already applies.
  snapshot jsonb not null,
  source_stream_id uuid references public.streams (id) on delete set null,
  generated_at timestamptz not null default now()
);

alter table public.chatter_notes enable row level security;

-- Only the owner of the community the membership belongs to. A member cannot
-- read the notes written about them, and no other channel's owner can either.
create policy "community owners read their chatter notes"
  on public.chatter_notes
  for select
  using (
    exists (
      select 1
        from public.memberships m
        join public.channels c on c.id = m.community_channel_id
       where m.id = chatter_notes.membership_id
         and c.owner_user_id = auth.uid()
    )
  );

-- Deliberately no insert, update or delete policy. Notes are written by the
-- post-broadcast pass with the service role, like every other post-broadcast
-- write, and nothing reachable by a user may write them.
