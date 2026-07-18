## Context

Stream time anchors to live_at (VOD start) like chat replay; transcript
segments provide context. The Activity tab renders panels per streamId; the
post-stream case resolves the latest ended stream server-side.

## Decisions

- clip_markers: id, channel_id, stream_id (cascade), chat_message_id,
  participant_key, origin, author_name, stream_time_s int, snippet text,
  created_at. Owner-only select.
- Handler: anchor = live_at ?? started_at ?? now; stream_time_s =
  max(0, (now - anchor)/1000); snippet = last 3 transcript segments joined;
  ack formats the time as h/m/s.
- Panel action getClipMarkersAction(streamId | null): null resolves the
  latest ended stream for the owner's channel; the ActivityContent renders the
  panel with the active streamId, and the /live page shows the panel with
  streamId null when no broadcast is active (Activity tab's empty state gains
  the panel below it).
- Seed: clip, cooldown 60, sort_order 33.

## Risks / Trade-offs

- Marker precision is +-1 worker pass (~10s) after the viewer's message —
  acceptable for shortlisting; the chat message timestamp is stored via
  chat_message_id for exact alignment if needed later.
