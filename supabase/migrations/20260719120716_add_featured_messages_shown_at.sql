alter table public.featured_messages
  add column shown_at timestamptz;

update public.featured_messages
set shown_at = promoted_at
where promoted_at is not null;
