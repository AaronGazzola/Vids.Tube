alter table public.channels
  add column handle text;

update public.channels
set handle = sub.handle
from (
  select
    id,
    case
      when length(normalized) < 3 then rpad(normalized, 3, '0')
      else left(normalized, 30)
    end as handle
  from (
    select
      id,
      coalesce(
        nullif(regexp_replace(lower(slug), '[^a-z0-9_]', '_', 'g'), ''),
        'user'
      ) as normalized
    from public.channels
  ) n
) sub
where public.channels.id = sub.id;

update public.channels
set slug = handle
where slug is distinct from handle;

alter table public.channels
  alter column handle set not null;

alter table public.channels
  add constraint channels_handle_format_check
  check (handle ~ '^[a-z0-9_]{3,30}$');

create unique index channels_handle_lower_key
  on public.channels (lower(handle));

alter table public.channels
  add constraint channels_owner_user_id_key unique (owner_user_id);
