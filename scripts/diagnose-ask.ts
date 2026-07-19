import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await admin
    .from("ask_requests")
    .select("created_at, question, status, include_answer, answer, reason")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  for (const a of data ?? []) console.log(JSON.stringify(a));

  const { data: events } = await admin
    .from("command_events")
    .select("created_at, keyword, args, status, reply")
    .eq("keyword", "ask")
    .order("created_at", { ascending: false })
    .limit(8);
  console.log("\n=== command_events (!ask) ===");
  for (const e of events ?? []) console.log(JSON.stringify(e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
