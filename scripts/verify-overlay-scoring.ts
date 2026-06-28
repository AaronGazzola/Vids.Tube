import { createClient } from "@supabase/supabase-js";
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

const TABLES = [
  "featured_messages",
  "viewer_scores",
  "score_events",
  "chat_scoring_state",
] as const;

async function main() {
  console.log("=== 1. RLS: anonymous SELECT should succeed (public read) ===");
  for (const t of TABLES) {
    const { error } = await anon.from(t).select("*").limit(1);
    console.log(`  ${t}: ${error ? "DENIED ✗ " + error.message : "readable ✓"}`);
  }

  console.log("\n=== 2. RLS: anonymous INSERT should be denied ===");
  const { error: cssInsErr } = await anon
    .from("chat_scoring_state")
    .insert({ stream_id: "00000000-0000-0000-0000-000000000000" });
  console.log(
    `  chat_scoring_state insert: ${cssInsErr ? "denied ✓ (" + cssInsErr.code + ")" : "ALLOWED ✗"}`
  );

  console.log("\n=== 3. Find a stream + chat message to feature ===");
  const { data: chat } = await admin
    .from("chat_messages")
    .select("id, stream_id, user_id, body")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!chat) {
    console.log("  No chat messages exist — skipping insert/animation test.");
    console.log("  (RLS verified above. Insert test needs a real chat row.)");
    return;
  }

  const { data: stream } = await admin
    .from("streams")
    .select("id, channel_id, status")
    .eq("id", chat.stream_id)
    .single();
  const { data: channel } = await admin
    .from("channels")
    .select("slug, handle")
    .eq("id", stream!.channel_id)
    .single();
  console.log(
    `  stream ${stream!.id} (status=${stream!.status}) channel @${channel!.handle} slug=${channel!.slug}`
  );
  console.log(`  chat message ${chat.id} by user ${chat.user_id}`);

  console.log("\n=== 4. Service-key insert of test rows (will clean up) ===");
  await admin.from("chat_scoring_state").upsert(
    { stream_id: chat.stream_id, enabled: true, updated_at: new Date().toISOString() },
    { onConflict: "stream_id" }
  );
  await admin.from("viewer_scores").upsert(
    {
      stream_id: chat.stream_id,
      user_id: chat.user_id,
      total_score: 42,
      features_count: 3,
      last_featured_at: new Date().toISOString(),
    },
    { onConflict: "stream_id,user_id" }
  );
  const { data: fm, error: fmErr } = await admin
    .from("featured_messages")
    .insert({
      stream_id: chat.stream_id,
      chat_message_id: chat.id,
      user_id: chat.user_id,
      score: 88,
      categories: ["humour", "contribution"],
      reason: "verification test row",
      ring_level: 3,
    })
    .select("id")
    .maybeSingle();
  await admin.from("score_events").insert({
    stream_id: chat.stream_id,
    user_id: chat.user_id,
    type: "feature",
    points: 88,
    metadata: { reason: "verification test" },
  });
  console.log(
    `  featured_messages insert: ${fmErr ? "FAILED ✗ " + fmErr.message : "ok ✓ id=" + fm?.id}`
  );

  console.log("\n=== 5. Read back via anon (what the overlay/leaderboard see) ===");
  const { data: pubFm } = await anon
    .from("featured_messages")
    .select("*")
    .eq("stream_id", chat.stream_id);
  const { data: pubVs } = await anon
    .from("viewer_scores")
    .select("*")
    .eq("stream_id", chat.stream_id)
    .order("features_count", { ascending: false });
  console.log(`  featured_messages rows: ${pubFm?.length}`);
  console.log(`  viewer_scores rows: ${pubVs?.length}, top features_count=${pubVs?.[0]?.features_count}`);
  console.log(`\n  Overlay URL: /overlay/${channel!.slug}`);

  console.log("\n=== 6. Cleanup test rows ===");
  if (fm?.id) await admin.from("featured_messages").delete().eq("id", fm.id);
  await admin.from("score_events").delete().eq("stream_id", chat.stream_id).eq("type", "feature").eq("points", 88);
  await admin.from("viewer_scores").delete().eq("stream_id", chat.stream_id).eq("user_id", chat.user_id!);
  await admin.from("chat_scoring_state").delete().eq("stream_id", chat.stream_id);
  console.log("  cleaned up ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
