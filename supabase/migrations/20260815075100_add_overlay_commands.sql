-- A chat command may belong to a framed overlay. Routing is then a lookup rather
-- than a branch somebody has to edit for each new game, which is the whole point:
-- the second overlay must need no change to the worker.
--
-- An overlay's command is an ORDINARY registry row from the moment it is created.
-- The streamer can disable it, change its cooldown and its per-stream limit, and
-- it appears on their public command guide beside every other command. An
-- overlay's commands are the streamer's commands, not a parallel system the
-- streamer cannot see.

alter table public.chat_commands
  drop constraint chat_commands_kind_check;

alter table public.chat_commands
  add constraint chat_commands_kind_check
  check (kind in ('builtin', 'custom', 'overlay'));

alter table public.chat_commands
  add column overlay_id uuid references public.overlays (id) on delete cascade;

create index chat_commands_overlay_idx
  on public.chat_commands (overlay_id)
  where overlay_id is not null;

alter table public.overlays
  add column commands jsonb not null default '[]'::jsonb;

comment on column public.overlays.commands is
  'Chat commands this overlay handles: keyword, description, and optionally cooldown_s and max_per_stream. Registered on a channel when the overlay is installed, withdrawn when it is removed.';

comment on column public.chat_commands.overlay_id is
  'Set when this command belongs to a framed overlay. Its execution is delivered to that overlay rather than answered in chat.';
