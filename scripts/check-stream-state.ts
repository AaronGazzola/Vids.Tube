import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await admin
    .from("streams")
    .select("id, status, title, started_at, live_at, last_seen_at, ended_at, created_at")
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!data?.length) {
    console.log("No preview/live streams found.");
    return;
  }
  const now = Date.now();
  for (const s of data) {
    const lastSeen = s.last_seen_at ? new Date(s.last_seen_at).getTime() : 0;
    const ageSec = lastSeen ? Math.round((now - lastSeen) / 1000) : null;
    console.log({
      id: s.id,
      status: s.status,
      title: s.title,
      last_seen_at: s.last_seen_at,
      seconds_since_last_seen: ageSec,
      considered_connected: s.status === "live" && ageSec !== null && ageSec <= 60,
    });
  }
}

main();
