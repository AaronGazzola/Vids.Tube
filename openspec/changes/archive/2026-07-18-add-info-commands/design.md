## Context

The registry, event log, cooldowns, and reply delivery exist. The settings form
saves through one toolbar action (saveStreamSettingsAction), so per-stream
exclusions join that form; channel-level command CRUD is channel data with
immediate owner-checked actions (same model as ChannelSettingsForm).

## Decisions

- `streams.disabled_commands text[] not null default '{}'`. The worker fetches
  it each pass (same cadence as fetchScoringSettings) and passes it into
  processCommands; an excluded keyword logs a `disabled` event.
- Custom execution in processCommands: kind custom → reply(row.response) when
  response is non-empty.
- Handlers (worker/lib/info-commands.ts), all no-AI:
  - rank/top: viewer_scores for the stream ordered by total_score; names from
    author_name, else the channel handle resolved from channels by user_id.
  - goal: stream_goals row + youtube ids from the stream; counts via
    fetchSubs/fetchVideoData; computeGoalProgress; degrades cleanly when goals
    or YouTube are missing.
  - uptime: streams.live_at (fallback started_at) → "live for Xh Ym".
- Seeds: rank/top/goal/uptime, cooldown 60, sort_order 20–23.
- Manager UI: command-admin actions (list-all/create/update/delete custom)
  owner-checked via supabaseAdmin; the list renders in settings-tab with
  checkboxes bound to form.disabledCommands (string[] of keywords); buildForm/
  buildPayload/saveStreamSettingsAction carry the field onto the stream row.

## Risks / Trade-offs

- !goal costs two YouTube API calls per invocation, bounded by its 60s
  cooldown.
- Keyword uniqueness for custom commands is enforced by the DB unique
  constraint; the action surfaces a friendly already-exists error.
