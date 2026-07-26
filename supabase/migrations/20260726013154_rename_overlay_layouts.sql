-- The demo layout table is the authoritative overlay layout (single-frame
-- overlay redesign): rename it accordingly and add a per-channel token that
-- gates the public overlay frame route.

alter table public.demo_layouts rename to overlay_layouts;

alter table public.overlay_layouts
  add column token text not null
  default md5(random()::text || clock_timestamp()::text);
