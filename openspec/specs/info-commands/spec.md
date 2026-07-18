# info-commands Specification

## Purpose

Owner-managed command content and live-stats builtins: custom text commands
answered from stored responses, !rank/!top/!goal/!uptime answered from
platform data, per-stream exclusions, and the /live Settings-tab manager
over the whole registry.

## Requirements

### Requirement: Custom text commands

The system SHALL execute a `kind='custom'` registry command by replying with its
stored response text through the standard origin-local delivery, subject to the
same cooldown/limit/disabled machinery as builtins.

#### Scenario: Custom command answers

- **WHEN** a viewer invokes an enabled custom command
- **THEN** the bot replies with that command's stored response text

### Requirement: Live-stats builtins

The system SHALL provide four builtins answered from platform data with no AI
call: `!rank` — the caller's rank and points on the current stream's
leaderboard (or a friendly no-points-yet line); `!top` — the top three chatters
with points; `!goal` — the stream's subs/likes/viewers goal progress (or a
not-configured line when goals/YouTube are absent); `!uptime` — time since
go-live (or a not-live-yet line).

#### Scenario: Rank for a scored viewer

- **WHEN** a viewer with points on the current stream sends `!rank`
- **THEN** the reply names their position and points

#### Scenario: Goal progress

- **WHEN** `!goal` runs on a stream with goals configured and a YouTube video
  linked
- **THEN** the reply reports current/target for subs, likes, and viewers

### Requirement: Per-stream command exclusion

The system SHALL let the owner exclude any command for the active stream
(`streams.disabled_commands`); excluded commands log `disabled` events and never
run. The worker SHALL refresh the exclusion list every pass so a mid-stream save
applies without a restart.

#### Scenario: Excluded for this stream

- **WHEN** the owner unchecks a command for the active stream and saves
- **THEN** invocations log `disabled` and produce no reply, while the command
  stays available for future streams

### Requirement: Settings-tab command manager

The system SHALL provide a "Chat commands" section in the /live Settings tab
listing the channel's full registry in one list: every command with its
`!keyword`, description, and a per-stream include checkbox (saved with the
toolbar Save changes action); custom commands SHALL additionally support add,
edit (keyword, description, response, cooldown), and delete via owner-checked
actions applied immediately; builtins SHALL NOT be editable or deletable. The
section SHALL show the existing worker running/stopped indicator since commands
require the worker.

#### Scenario: Owner adds a custom command

- **WHEN** the owner adds `!pc` with a response describing their hardware
- **THEN** the command appears in the registry, on the public guide page, and
  viewers invoking `!pc` receive the response

#### Scenario: Builtins are managed but not editable

- **WHEN** the owner views a builtin row
- **THEN** it offers the per-stream checkbox but no edit or delete controls
