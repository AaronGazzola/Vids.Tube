-- Each overlay signs its tokens with a secret of its own, so one overlay can
-- neither verify nor forge another's, and a compromised overlay is contained to
-- itself and revoked by rotating one row.
--
-- The secret lives in its own table rather than on public.overlays because that
-- table is world-readable when an overlay is published, and row level security
-- protects rows, not columns. A table nobody can read is harder to get wrong
-- than a column somebody has to remember to leave out of every select.

create table public.overlay_secrets (
  overlay_id uuid primary key references public.overlays (id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.overlay_secrets enable row level security;

-- No policies, deliberately. Row level security with no policy denies every
-- client, signed in or not; only the service role reaches this table. The
-- absence below is the security control, not an omission.
