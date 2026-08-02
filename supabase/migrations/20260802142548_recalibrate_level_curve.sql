-- The level curve was set when a single message paid over 100 points, so every
-- level cost far more than the new scoring can produce: the most prolific
-- chatter in a year of streams would have reached level 2. Level 1 now costs 25
-- experience rather than 100, which puts the busiest contributor near level 9
-- and a regular attender near level 4.
--
-- Level 1 at 25, 2 at 100, 3 at 225, 5 at 625, 10 at 2500, 20 at 10000.
create or replace function public.level_for_xp(xp bigint)
returns int
language sql
immutable
as $$
  select case
    when xp <= 0 then 0
    else floor(sqrt(xp / 25.0))::int
  end;
$$;
