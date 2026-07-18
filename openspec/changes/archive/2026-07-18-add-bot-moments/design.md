## Context

Outbound bot chat lives in the worker (VidsBot rows + Nightbot queue). The
settings form, panel patterns, and per-pass worker hooks are established. The
scoring pass is the natural tick for proactive checks.

## Decisions

- channel_projects: id, channel_id (cascade), name, blurb, domain_url,
  repo_url, sort_order, timestamps; public select (harmless, feeds public bot
  messages), owner-checked CRUD via service role.
- chat_scoring_state gains six booleans, all default false for proactive
  (useful_info_enabled, competition_status_enabled, progress_update_enabled)
  and default true for wrap-up (wrapup_mvp_enabled, wrapup_summary_enabled,
  wrapup_thanks_enabled). All ride StreamSettings/SettingsForm with SwitchRows
  in a "Bot moments" section.
- streams.wrapup_requested_at / wrapup_done_at timestamps; the Activity tab
  Wrap up button (confirm dialog, visible while live/preview) stamps
  requested_at via an owner action; the worker pass sends the enabled trio and
  stamps done_at (idempotence = done_at null check).
- worker/lib/moments.ts:
  - sendBroadcast(streamId, text): VidsBot row + Nightbot enqueue.
  - runProactiveMoments(stream, channelId): in-memory last-run per type;
    intervals env-overridable (USEFUL_INFO_INTERVAL_MS default 300000,
    COMPETITION_STATUS_INTERVAL_MS 600000, PROGRESS_UPDATE_INTERVAL_MS
    1200000). Competition: top-3 from viewer_scores (skip when empty).
    Progress: "Currently building: name — blurb domain repo" lines. Useful
    info: last ~2 minutes of transcript to Claude with a strict JSON verdict
    {found, answer}; only posts when found with a confident answer.
  - runWrapupIfRequested(stream): requested_at set and done_at null → send
    enabled messages (MVP from viewer_scores + resolved name; summary from a
    Claude pass over the transcript, <=400; thanks from a template + project
    links) then stamp done_at.
- ask grounding: append the projects list ("Projects: name — blurb (domain,
  repo)") so !ask can answer project questions with real links.

## Risks / Trade-offs

- In-memory proactive timers reset on worker restart (worst case an early
  repeat post) — acceptable.
- Useful-info quality rides on the strict verdict prompt; when unsure the
  model is instructed to return found=false.
