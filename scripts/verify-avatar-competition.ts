import { createClient } from "@supabase/supabase-js";
import { MAX_STEM, MIN_STEM, plantShape } from "../lib/plant";
import type { Database } from "../supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const anon = createClient<Database>(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? "PASS" : "FAIL ✗"}  ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log("=== 1. plantShape (pure) ===");
  const leader = plantShape(100, 100);
  assert(
    leader.growth === 1 && leader.stemPx === MAX_STEM && leader.leafPairs === 5,
    "leader (score == topScore) is max height + max leaves"
  );

  const half = plantShape(50, 100);
  assert(half.growth === 0.5 && half.stemPx === 150, "half score → mid height");

  assert(
    plantShape(80, 100).stemPx >= plantShape(40, 100).stemPx,
    "monotonic: higher score → taller (or equal)"
  );

  const none = plantShape(10, 0);
  assert(
    none.growth === 0 && none.stemPx === MIN_STEM && none.leafPairs === 0,
    "topScore 0 → min plant"
  );

  assert(plantShape(50, 100, 6).flowers === 3, "features_count 6 → 3 accent flowers");
  assert(plantShape(50, 100, 100).flowers === 4, "flowers cap at 4");

  console.log("\n=== 2. viewer_scores is the (public) data source ===");
  const { error } = await anon.from("viewer_scores").select("total_score").limit(1);
  assert(!error, "anon can read viewer_scores (the competition data source)");
  console.log(
    "  (getCompetitionAction is a server action gated on a live stream — its live path is owner-verified)"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
