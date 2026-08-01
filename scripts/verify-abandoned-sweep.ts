// Verifies the abandoned-live-stream sweep against the remote database:
// the cron job is registered, the function is service-role only, and each
// guard behaves. Every guard case seeds a real live broadcast (open gap +
// finalized processing VOD), runs the real function, then ROLLS BACK, so
// nothing is ever committed and no probe broadcast is ever publicly visible.
//
// Needs SUPABASE_ACCESS_TOKEN (Management API):
//   doppler run -c dev_personal -- npm run verify:abandoned-sweep
import { PROJECT_REF } from "../supabase/config-api";

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

async function query(sql: string): Promise<unknown[]> {
  const res = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`query failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return Array.isArray(body) ? body : [];
}

type Case = {
  name: string;
  lastSeen: string;
  breakEnds: string;
  expectEnded: boolean;
};

const CASES: Case[] = [
  { name: "fresh feed (30s)", lastSeen: "now() - interval '30 seconds'", breakEnds: "null", expectEnded: false },
  { name: "disconnected 90 min", lastSeen: "now() - interval '90 minutes'", breakEnds: "null", expectEnded: false },
  { name: "disconnected 4 hours", lastSeen: "now() - interval '4 hours'", breakEnds: "null", expectEnded: true },
  { name: "4h silent, break still running", lastSeen: "now() - interval '4 hours'", breakEnds: "now() + interval '3 hours'", expectEnded: false },
  { name: "8h silent, break ended 5h ago", lastSeen: "now() - interval '8 hours'", breakEnds: "now() - interval '5 hours'", expectEnded: true },
  { name: "never seen, started 5h ago", lastSeen: "null", breakEnds: "null", expectEnded: true },
];

// Seed one live broadcast (with an open gap and a finalized processing VOD),
// run the real sweep, observe, then ROLL BACK — nothing is ever committed, so
// the probe broadcast is never publicly visible.
function probeSql(c: Case): string {
  return `
begin;

create temp table probe on commit drop as
with ch as (select id from public.channels order by created_at limit 1),
ins as (
  insert into public.streams
    (channel_id, status, started_at, live_at, last_seen_at, break_ends_at, title)
  select ch.id, 'live', now() - interval '5 hours', now() - interval '5 hours',
         ${c.lastSeen}, ${c.breakEnds}, '__sweep_probe__'
  from ch
  returning id, channel_id
)
select id, channel_id from ins;

insert into public.stream_gaps (stream_id, gap_start_at)
select id, now() - interval '10 hours' from probe;

insert into public.videos (channel_id, source_stream_id, status, mp4_path, title)
select channel_id, id, 'processing', 'vod/probe/probe.mp4', '__sweep_probe__' from probe;

select public.end_abandoned_live_streams() as swept;

select
  s.status as stream_status,
  s.ended_at::text as ended_at,
  (select count(*) from public.stream_gaps g where g.stream_id = s.id and g.gap_end_at is null) as open_gaps,
  (select v.status from public.videos v where v.source_stream_id = s.id) as video_status
from public.streams s
join probe p on p.id = s.id;

rollback;
`;
}

async function main() {
  console.log("=== cron job ===");
  console.log(
    JSON.stringify(
      await query(
        `select jobname, schedule, command, active from cron.job where jobname = 'end-abandoned-live-streams'`
      )
    )
  );

  console.log("=== function definition ===");
  console.log(
    JSON.stringify(
      await query(
        `select p.proname, p.prosecdef as security_definer,
                coalesce(array_to_string(p.proacl, ', '), '(owner only)') as acl
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'end_abandoned_live_streams'`
      )
    )
  );

  console.log("=== guard cases (seeded, swept, rolled back) ===");
  let failures = 0;
  for (const c of CASES) {
    const rows = await query(probeSql(c));
    const observed = rows.find(
      (r): r is Record<string, unknown> =>
        typeof r === "object" && r !== null && "stream_status" in r
    );
    const ended = observed?.stream_status === "ended";
    const ok = ended === c.expectEnded;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name} — expected ended=${c.expectEnded}; ${JSON.stringify(observed)}`
    );
  }

  console.log("=== leftover probe rows (must both be 0) ===");
  console.log(
    JSON.stringify(
      await query(
        `select (select count(*) from public.streams where title = '__sweep_probe__') as probe_streams,
                (select count(*) from public.videos where title = '__sweep_probe__') as probe_videos`
      )
    )
  );

  if (failures > 0) {
    console.error(`${failures} guard case(s) FAILED`);
    process.exit(1);
  }
  console.log("all guard cases passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
