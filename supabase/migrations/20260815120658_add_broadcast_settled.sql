-- Whether a broadcast's chat replay has been accounted for.
--
-- `clean` says every step of a phase succeeded on the day. It cannot also mean
-- "nothing further is owed", because the YouTube chat replay does not become
-- downloadable for 16 to 24 hours and a broadcast recorded clean was skipped
-- forever. Three August broadcasts are recorded clean while holding roughly half
-- their chat, for exactly that reason.
--
-- Keeping the two apart means no record has to be un-written when a replay
-- arrives later, and what passed on the night stays readable.
alter table public.broadcast_completions
  add column if not exists settled boolean not null default false,
  add column if not exists settled_at timestamptz,
  add column if not exists settle_note text;

comment on column public.broadcast_completions.clean is
  'Every step of the phase that ran succeeded. Says nothing about whether the chat replay has been merged.';

comment on column public.broadcast_completions.settled is
  'The chat replay has been accounted for, by merging it or by concluding there is none. The sweep selects broadcasts that are not settled.';

comment on column public.broadcast_completions.settle_note is
  'How the broadcast came to be settled. A broadcast closed because no replay ever appeared is not the same record as one whose replay was merged.';

create index if not exists broadcast_completions_settled_idx
  on public.broadcast_completions (settled);

-- Every broadcast already carrying a clean record was topped up by the old pass
-- or by `npm run repair`, so the first sweep must not re-fetch 171 replays.
-- Marked with the reason rather than silently, so these are never mistaken for
-- broadcasts the two-phase runner settled itself.
update public.broadcast_completions
set settled = true,
    settled_at = coalesce(finished_at, updated_at, now()),
    settle_note = 'repaired before phases existed'
where clean = true
  and settled = false;
