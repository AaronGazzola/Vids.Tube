// Reports which broadcasts have been turned into complete community data and
// which are outstanding. `--seed-processed` records a clean pass for broadcasts
// that were already completed by hand this cycle, so catch-up starts from a
// truthful position rather than re-walking the whole history.
import { createClient } from "@supabase/supabase-js";
import { STEP_ORDER } from "../lib/post-broadcast-plan";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const SEED = argv.includes("--seed-processed");
const APPLY = argv.includes("--apply");

async function page<T>(table: "streams" | "broadcast_completions" | "score_events", cols: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < size) break;
  }
  return out;
}

async function main() {
  const streams = await page<{ id: string; status: string; started_at: string }>(
    "streams",
    "id,status,started_at"
  );
  const records = await page<{ stream_id: string; clean: boolean; attempts: number }>(
    "broadcast_completions",
    "stream_id,clean,attempts"
  );
  const ratings = await page<{ stream_id: string }>("score_events", "stream_id");

  const ended = streams.filter((s) => s.status === "ended");
  const byStream = new Map(records.map((r) => [r.stream_id, r]));
  const scored = new Set(ratings.map((r) => r.stream_id));

  const clean = ended.filter((s) => byStream.get(s.id)?.clean);
  const failed = ended.filter((s) => byStream.has(s.id) && !byStream.get(s.id)!.clean);
  const outstanding = ended.filter((s) => !byStream.has(s.id));

  console.log(`ended broadcasts: ${ended.length}`);
  console.log(`  completed cleanly: ${clean.length}`);
  console.log(`  attempted and failed: ${failed.length}`);
  console.log(`  no record at all: ${outstanding.length}`);
  for (const s of failed.slice(0, 10)) {
    console.log(`    failed ${s.started_at?.slice(0, 10)} after ${byStream.get(s.id)?.attempts} attempt(s)`);
  }

  if (!SEED) {
    if (outstanding.length) {
      console.log(
        `\n${outstanding.length} broadcasts would be caught up by a worker start; add --seed-processed --apply to record the ones already done by hand`
      );
    }
    return;
  }

  // A broadcast that already carries ratings was scored during this cycle, and
  // the memberships and ledger were rebuilt afterwards across the whole set.
  // Recording that as a clean pass stops catch-up repeating work already done.
  const toSeed = outstanding.filter((s) => scored.has(s.id));
  const steps: Record<string, { ok: boolean; detail: string }> = {};
  for (const step of STEP_ORDER) {
    steps[step] = { ok: true, detail: "completed by hand during the 2026-08 cycle" };
  }

  console.log(`\nbroadcasts to seed as clean: ${toSeed.length}`);
  console.log(`broadcasts left outstanding after seeding: ${outstanding.length - toSeed.length}`);
  if (!APPLY) {
    console.log("dry run — add --apply to write.");
    return;
  }

  for (let i = 0; i < toSeed.length; i += 100) {
    const { error } = await admin.from("broadcast_completions").upsert(
      toSeed.slice(i, i + 100).map((s) => ({
        stream_id: s.id,
        steps: steps as never,
        clean: true,
        attempts: 1,
        finished_at: new Date().toISOString(),
      })),
      { onConflict: "stream_id" }
    );
    if (error) throw new Error(error.message);
  }
  console.log(`seeded ${toSeed.length} clean records`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
