-- The overlay formerly called "members" is the message banner: it carries the
-- streamer's own formatted lines, and the member count beside them is the
-- smaller half of it. This moves its entry in every saved layout.
--
-- The config is one JSON column holding every overlay's position, so the move is
-- done key by key rather than by rebuilding the object: nothing else may shift.
-- Idempotent by construction — a config already carrying the new key is skipped,
-- so re-running changes nothing.

update public.overlay_layouts
set config =
  case
    when config -> 'boxes' ? 'members'
      then jsonb_set(
        config,
        '{boxes}',
        (config -> 'boxes') - 'members'
          || jsonb_build_object('messageBanner', config -> 'boxes' -> 'members')
      )
    else config
  end
where config -> 'boxes' ? 'members';

update public.overlay_layouts
set config = jsonb_set(
  config,
  '{visible}',
  (config -> 'visible') - 'members'
    || jsonb_build_object('messageBanner', config -> 'visible' -> 'members')
)
where config -> 'visible' ? 'members';

update public.overlay_layouts
set config = jsonb_set(
  config,
  '{boxOpacity}',
  (config -> 'boxOpacity') - 'members'
    || jsonb_build_object('messageBanner', config -> 'boxOpacity' -> 'members')
)
where config -> 'boxOpacity' ? 'members';
