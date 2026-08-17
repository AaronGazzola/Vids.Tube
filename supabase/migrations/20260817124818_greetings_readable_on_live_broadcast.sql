-- The overlay needs to read who has just been greeted, and it was doing it with
-- the service role. That is the wrong tool: a server action is a public
-- endpoint, and reaching for the service role there means row-level security is
-- switched off and the authorization is reimplemented by hand in TypeScript, in
-- one place, where the next caller will not know to repeat it.
--
-- The rule belongs in the database instead. `stream_greetings` was left with RLS
-- on and no policies at all, on the reasoning that who has been greeted is
-- worker bookkeeping. That holds for a finished broadcast. It does not hold for
-- a live one: the greeting is going on screen in front of the audience the
-- moment it is written, and the name and picture it carries are already public
-- on the chatter's channel page.
--
-- So: readable exactly while the broadcast is live, and closed again the moment
-- it ends. The window the overlay can see is the window the audience can see.
create policy "greetings on a live broadcast are readable"
  on public.stream_greetings
  for select
  using (
    exists (
      select 1
        from public.streams s
       where s.id = stream_greetings.stream_id
         and s.status = 'live'
    )
  );

-- Writing stays service-role only, as it was: greetings are claimed by the
-- worker and by nothing else.
