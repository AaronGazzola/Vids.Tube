-- The member count used to be a fixed feature of the banner's first message.
-- It is now one metric among several, chosen per message. Removing the fixed
-- rule without moving the count would take the number off air until the
-- streamer noticed, so the first message inherits exactly what was being
-- rendered before: the member count with the Vids.Tube logo.
--
-- Only the first message, and only where it carries no metric already, so
-- re-running changes nothing.

update public.overlay_layouts
set config = jsonb_set(
  config,
  '{messages,0,metric}',
  jsonb_build_object(
    'kind', 'members',
    'icon', 'logo',
    'color', '#ffffff'
  )
)
where jsonb_typeof(config -> 'messages') = 'array'
  and jsonb_array_length(config -> 'messages') > 0
  and jsonb_typeof(config -> 'messages' -> 0) = 'object'
  and not (config -> 'messages' -> 0 ? 'metric');
