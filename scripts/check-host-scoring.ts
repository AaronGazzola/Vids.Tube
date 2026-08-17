import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

// Read-only. Reports whether the host has been scored, featured or charged on
// their own broadcasts, which is what the missing host mark on Vids.Tube chat
// caused. Prints counts only: an account id is never printed.
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: channels } = await admin
    .from("channels")
    .select("id, owner_user_id")
    .not("owner_user_id", "is", null);

  const owners = new Map<string, string>();
  for (const c of channels ?? []) {
    if (c.owner_user_id) owners.set(c.id, c.owner_user_id);
  }

  const { data: streams } = await admin
    .from("streams")
    .select("id, channel_id, started_at, status")
    .order("started_at", { ascending: false })
    .limit(40);

  let scoredRows = 0;
  let scoredPoints = 0;
  let featured = 0;
  let charges = 0;
  const affected: string[] = [];

  for (const s of streams ?? []) {
    const host = owners.get(s.channel_id);
    if (!host) continue;

    const { data: scores } = await admin
      .from("viewer_scores")
      .select("total_score")
      .eq("stream_id", s.id)
      .eq("participant_key", host);

    const { count: feat } = await admin
      .from("featured_messages")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .eq("user_id", host);

    const { count: cmds } = await admin
      .from("command_events")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .eq("participant_key", host)
      .eq("status", "insufficient");

    const rows = scores?.length ?? 0;
    const points = (scores ?? []).reduce((n, r) => n + (r.total_score ?? 0), 0);
    if (rows || feat || cmds) {
      affected.push(
        `${s.started_at?.slice(0, 10) ?? "?"} (${s.status}): ${rows} score row(s), ${points} points, ${feat ?? 0} featured, ${cmds ?? 0} refused command(s)`
      );
    }
    scoredRows += rows;
    scoredPoints += points;
    featured += feat ?? 0;
    charges += cmds ?? 0;
  }

  console.log(`streams checked: ${streams?.length ?? 0}`);
  console.log(`host score rows: ${scoredRows} (${scoredPoints} points)`);
  console.log(`host featured messages: ${featured}`);
  console.log(`host commands refused for credits: ${charges}`);
  if (affected.length) {
    console.log("\naffected broadcasts:");
    for (const line of affected) console.log(`  ${line}`);
  } else {
    console.log("\nnothing to clean up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
