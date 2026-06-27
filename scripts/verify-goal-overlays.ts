import { createClient } from "@supabase/supabase-js";
import { computeGoalProgress } from "../lib/goals";
import type { Database } from "../supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient<Database>(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? "PASS" : "FAIL ✗"}  ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log("=== 1. computeGoalProgress (pure) ===");
  const p = computeGoalProgress(
    { subs: 980, likes: 410, viewers: 78 },
    { subs: 950, likes: 0, viewers: 0 },
    { subs: 1000, likes: 500, viewers: 100 }
  );
  assert(
    p.subs.current === 30 && p.subs.target === 50 && p.subs.pct === 60,
    "subs gain-from-baseline (30/50 = 60%)"
  );
  assert(
    p.viewers.current === 78 && p.viewers.pct === 78,
    "viewers absolute (78/100 = 78%)"
  );
  assert(!p.subs.reached, "subs not reached at 60%");

  const reached = computeGoalProgress(
    { subs: 1000, likes: 0, viewers: 0 },
    { subs: 950, likes: 0, viewers: 0 },
    { subs: 1000, likes: 500, viewers: 100 }
  );
  assert(
    reached.subs.pct === 100 && reached.subs.reached,
    "subs clamps to 100 and reached flips true"
  );

  const noBaseline = computeGoalProgress(
    { subs: 40, likes: 0, viewers: 0 },
    null,
    { subs: 100, likes: 500, viewers: 100 }
  );
  assert(
    noBaseline.subs.current === 40 && noBaseline.subs.pct === 40,
    "null baseline treated as 0 (40/100 = 40%)"
  );

  console.log("\n=== 2. stream_goals schema/RLS ===");
  const { data: stream } = await admin
    .from("streams")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!stream) {
    console.log("  no streams exist — skipping DB checks");
    return;
  }
  const streamId = stream.id;

  const { error: upErr } = await admin.from("stream_goals").upsert(
    { stream_id: streamId, subs_goal: 1000, likes_goal: 500, viewers_goal: 100 },
    { onConflict: "stream_id" }
  );
  assert(!upErr, `service upsert stream_goals ${upErr?.message ?? ""}`);

  const { error: readErr } = await anon
    .from("stream_goals")
    .select("subs_goal")
    .eq("stream_id", streamId)
    .maybeSingle();
  assert(!readErr, "anon can read stream_goals");

  const { error: anonIns } = await anon
    .from("stream_goals")
    .insert({ stream_id: streamId, subs_goal: 1 });
  assert(
    !!anonIns && anonIns.code === "42501",
    `anon insert denied (${anonIns?.code ?? "ALLOWED"})`
  );

  console.log("\n=== 3. cleanup ===");
  await admin.from("stream_goals").delete().eq("stream_id", streamId);
  console.log("  cleaned up");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
