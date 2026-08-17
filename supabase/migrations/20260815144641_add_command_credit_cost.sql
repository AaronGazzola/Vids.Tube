-- Credits become spendable. The ledger already had `spend_credits`, which
-- already refuses a spend the balance cannot cover; what was missing was
-- anything that called it. A command now carries a price, and !tts is the first
-- thing worth paying for.

-- The price is data on the registry row, like the cooldown and the per-stream
-- limit beside it, so the owner changes it without a deploy. The check is what
-- stops a command paying a chatter.
alter table public.chat_commands
  add column if not exists credit_cost integer not null default 0;

alter table public.chat_commands drop constraint if exists chat_commands_credit_cost_check;
alter table public.chat_commands
  add constraint chat_commands_credit_cost_check check (credit_cost >= 0);

comment on column public.chat_commands.credit_cost is
  'Credits charged to the invoking chatter before the command executes. 0 is free, which is what every command was before this existed. Priced against the joining grant: see grant_joining_credits.';

-- A refusal for an empty purse is its own outcome. Folding it into `limit` or
-- `disabled` would make the event log unable to answer why a command did not
-- run, which is the one question the log exists to answer.
alter table public.command_events drop constraint if exists command_events_status_check;
alter table public.command_events
  add constraint command_events_status_check
  check (status in ('executed', 'cooldown', 'limit', 'disabled', 'unknown', 'insufficient'));

-- !tts is the first sink, at one credit. Applied to every channel, matching how
-- the command itself was seeded across all channels when TTS shipped.
update public.chat_commands
   set credit_cost = 1
 where builtin_key = 'tts'
   and credit_cost = 0;

-- One charge per chat message, enforced here rather than by the caller
-- remembering to look. A batch that is reprocessed must not bill a chatter
-- twice for the same line.
create unique index if not exists credit_entries_one_command_charge_per_source
  on public.credit_entries (source_id)
  where kind = 'command' and source_id is not null;
