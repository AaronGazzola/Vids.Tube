## Context

The command layer dispatches builtins with a CommandContext (stream, message,
args, reply). chatter_stats holds YouTube aggregates keyed by author channel id;
viewer_scores holds per-stream vids.tube scoring keyed by user_id; verified
youtube_links bridges them. The worker already shells to Claude (runClaude).

## Decisions

- Profile key: `youtube:<channelId>` when the caller is a YouTube chatter or a
  verified-linked vids.tube user; otherwise `user:<userId>`.
- Stats gathered per call (cheap queries): chatter_stats row; vids.tube
  aggregate = sum(total_score), sum(features_count), count(distinct stream_id)
  from viewer_scores by user_id; combined totalMessages for threshold purposes =
  youtube total_messages + vidstube message-ish proxy (score rows count) — the
  snapshot stores whatever numbers were used so the threshold compares
  like-with-like.
- Regeneration: |current.totalMessages - snapshot.totalMessages| >= 20 OR
  current.videosAttended != snapshot.videosAttended.
- Prompt: identity name + stats lines + "write a warm, playful mini-bio in
  under 350 characters, plain text, second person, no hashtags"; output
  truncated to 400 chars before caching (word boundary + ellipsis).
- me_profiles: profile_key text pk, profile text, snapshot jsonb, generated_at;
  owner-read RLS, service-role writes.
- Registry seed: keyword 'me', builtin_key 'me', cooldown_s 600, sort_order 10.
- First-timer reply is a constant; no profile row stored.

## Risks / Trade-offs

- A generation blocks the worker loop a few seconds — same cost profile as the
  scoring call and rate-limited by the 600s cooldown.
- Live-stream messages don't update chatter_stats until a backfill run; the
  bio may lag current-stream activity. Accepted (stats describe history).
