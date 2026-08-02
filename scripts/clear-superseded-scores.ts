// Removes ratings written under a superseded scoring rubric. These cannot be
// re-derived: the dimensions the old rubric asked for do not mean what the
// current ones mean, so the only honest option is to delete and re-score.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { SCORING_CONFIG } from "../lib/scoring-config";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SNAPSHOT = argv.includes("--snapshot")
  ? argv[argv.indexOf("--snapshot") + 1]
  : ".snapshots/superseded-scores.json";

async function main() {
  const { data: all, error } = await admin
    .from("score_events")
    .select("id,stream_id,scoring_version,points,origin,external_author_id,user_id,metadata");
  if (error) throw new Error(error.message);

  const superseded = (all ?? []).filter(
    (r) => r.scoring_version !== SCORING_CONFIG.version
  );
  const byVersion = new Map<string, { n: number; points: number; streams: Set<string> }>();
  for (const r of superseded) {
    const v = r.scoring_version ?? "unversioned (old rubric)";
    const cur = byVersion.get(v) ?? { n: 0, points: 0, streams: new Set<string>() };
    cur.n += 1;
    cur.points += r.points;
    cur.streams.add(r.stream_id);
    byVersion.set(v, cur);
  }

  console.log(`current scoring configuration: ${SCORING_CONFIG.version}`);
  console.log(`ratings in total: ${all?.length ?? 0}`);
  console.log(`superseded: ${superseded.length}`);
  for (const [v, c] of byVersion) {
    console.log(`  ${v}: ${c.n} ratings, ${c.points} points, ${c.streams.size} broadcasts`);
  }
  if (!superseded.length) {
    console.log("nothing to clear");
    return;
  }

  const streams = [...new Set(superseded.map((r) => r.stream_id))];
  writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), superseded, streams }, null, 2)
  );
  console.log(`snapshot written to ${SNAPSHOT}`);

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply to clear.");
    return;
  }

  const { error: delErr, count } = await admin
    .from("score_events")
    .delete({ count: "exact" })
    .in(
      "id",
      superseded.map((r) => r.id)
    );
  if (delErr) throw new Error(delErr.message);
  console.log(`deleted ${count ?? superseded.length} ratings`);

  // The per-broadcast score rows they fed are now wrong; the re-score rewrites
  // them, but leaving stale totals in the meantime would inflate standing.
  const { error: vsErr, count: vsCount } = await admin
    .from("viewer_scores")
    .delete({ count: "exact" })
    .in("stream_id", streams);
  if (vsErr) throw new Error(vsErr.message);
  console.log(`deleted ${vsCount ?? 0} per-broadcast score rows across ${streams.length} broadcasts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
