-- An overlay's settings, stored per channel per overlay. The host stores these,
-- hands them over and edits them, and never interprets a single value: modelling
-- one game's settings as columns here would force a migration for the second game
-- and make this database responsible for validating meanings it cannot know.
--
-- What the host does know is shape. An overlay declares its fields, and the
-- editor draws a slider for a number in a range without ever learning that the
-- number is how large a creature is.

alter table public.overlays
  add column settings_fields jsonb not null default '[]'::jsonb;

alter table public.channel_overlays
  add column settings jsonb not null default '{}'::jsonb;

comment on column public.overlays.settings_fields is
  'Ordered field declarations: key, label, type, and optionally default, help, min, max, step, options. Rendered by the host, never interpreted.';

comment on column public.channel_overlays.settings is
  'This channel''s values for this overlay. Opaque to the host. A value whose key the overlay no longer declares is retained, not dropped.';
