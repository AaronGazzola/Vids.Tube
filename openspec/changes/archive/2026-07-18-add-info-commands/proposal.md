## Why

The owner wants a self-service command set: personal/project FAQ answers
(`!age`, `!job`, `!pc`, `!stack`, …) editable as data, live stats commands
(`!rank`, `!top`, `!goal`, `!uptime`) answered from tables the platform already
maintains, and a Settings-tab manager that controls the whole registry —
including which commands are active for the current stream.

## What Changes

- **Custom text commands execute**: a `kind='custom'` registry row replies with
  its stored `response` text through the normal reply delivery.
- **Live-stats builtins** (registry rows seeded, cooldown 60s): `!rank` (the
  caller's position and points on the current stream's leaderboard), `!top`
  (top three chatters), `!goal` (subs/likes/viewers progress from the stream's
  goals), `!uptime` (time since go-live).
- **Per-stream exclusion**: `streams.disabled_commands text[]` — commands
  unchecked for the active stream log `disabled` events and do not run; the
  worker refreshes the list every pass so mid-stream saves apply.
- **Settings-tab manager** ("Chat commands" section on /live): one unified list
  of the channel's commands — builtins show name/description with a per-stream
  include checkbox; custom commands additionally support add, edit
  (keyword/description/response/cooldown), and delete, applied immediately via
  owner-checked actions. The per-stream checkboxes ride the existing settings
  form and save with the toolbar Save changes action. The section carries the
  existing worker-required status treatment (running/stopped from the
  heartbeat).

## Capabilities

### New Capabilities

- `info-commands`: custom command execution, the four live-stats builtins,
  per-stream exclusion, and the Settings-tab registry manager.

## Non-goals / Related

- Command *content* (the owner's answers) is data the owner types in, not spec.
- `!tts`, `!ask`, `!catchup`, `!clip` are their own changes; they will appear in
  this manager automatically once their registry rows exist.

## Impact

- Migration: `streams.disabled_commands` + seed rank/top/goal/uptime + types.
- `worker/lib/info-commands.ts` (new handlers), `worker/lib/commands.ts`
  (custom execution, disabled-per-stream, handler registration),
  `worker/jobs/score.ts` (pass the per-stream exclusion list, refreshed per
  pass).
- `app/(app)/live/settings-tab.tsx` + `page.tsx` form plumbing +
  `broadcast.actions.ts` (`disabled_commands` in the settings payload) + new
  command-admin actions/hooks in `app/(app)/live/`.
- `scripts/verify-info-commands.ts`, e2e for the manager UI.
