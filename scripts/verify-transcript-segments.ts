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

async function main() {
  console.log("=== 1. anon SELECT should succeed (public read) ===");
  const { error: readErr } = await anon
    .from("transcript_segments")
    .select("*")
    .limit(1);
  console.log(
    `  transcript_segments read: ${readErr ? "DENIED ✗ " + readErr.message : "readable ✓"}`
  );

  console.log("\n=== 2. anon INSERT should be denied ===");
  const { data: anyStream } = await admin
    .from("streams")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!anyStream) {
    console.log("  no streams exist — cannot run insert test; RLS read verified above.");
    return;
  }
  const { error: insErr } = await anon.from("transcript_segments").insert({
    stream_id: anyStream.id,
    start_s: 0,
    end_s: 1,
    text: "anon should not write",
  });
  console.log(
    `  anon insert: ${insErr ? "denied ✓ (" + insErr.code + ")" : "ALLOWED ✗"}`
  );

  console.log("\n=== 3. service insert + anon read-back + cleanup ===");
  const { data: row, error: svcErr } = await admin
    .from("transcript_segments")
    .insert({
      stream_id: anyStream.id,
      start_s: 12.5,
      end_s: 15.25,
      text: "verification test segment",
    })
    .select("id")
    .maybeSingle();
  console.log(
    `  service insert: ${svcErr ? "FAILED ✗ " + svcErr.message : "ok ✓ id=" + row?.id}`
  );
  const { data: pub } = await anon
    .from("transcript_segments")
    .select("start_s,end_s,text")
    .eq("stream_id", anyStream.id);
  console.log(`  anon reads back ${pub?.length} row(s) for the stream`);
  if (row?.id) {
    await admin.from("transcript_segments").delete().eq("id", row.id);
    console.log("  cleaned up ✓");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
