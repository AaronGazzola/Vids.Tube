import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import {
  buildScoringPrompt,
  parseScoreResult,
} from "../worker/lib/scoring-prompt";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient<Database>(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EXT = "UC_TEST_SCORING";

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? "PASS" : "FAIL ✗"}  ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log("=== 1. pure prompt/parse (no CLI) ===");
  const raw =
    '```json\n{"featured":[{"ref":"vidstube:abc","score":91,"categories":["humour"],"reason":"nice"}],"scores":[{"ref":"vidstube:abc","engagement":80,"humour":90,"contribution":40},{"ref":"youtube:UCx:t","engagement":10,"humour":5,"contribution":0}]}\n```';
  const result = parseScoreResult(raw);
  assert(result.featured.length === 1, "parses one featured pick");
  assert(result.featured[0].score === 91, "featured score parsed");
  assert(result.scores.length === 2, "parses two score deltas");
  const bad = parseScoreResult("totally not json");
  assert(
    bad.featured.length === 0 && bad.scores.length === 0,
    "malformed input yields empty result"
  );
  const prompt = buildScoringPrompt({
    transcript: "the streamer says hello",
    messages: [
      { ref: "vidstube:abc", origin: "vidstube", author: "bob", text: "lol" },
    ],
  });
  assert(prompt.includes("vidstube:abc"), "prompt includes the message ref");

  console.log("\n=== 2. schema: youtube-origin rows (null user_id) ===");
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

  const { data: fm, error: fmErr } = await admin
    .from("featured_messages")
    .insert({
      stream_id: streamId,
      chat_message_id: null,
      user_id: null,
      origin: "youtube",
      external_author_id: TEST_EXT,
      author_name: "Test YouTuber",
      author_avatar_url: "https://example.com/a.jpg",
      score: 77,
      categories: ["humour"],
      reason: "test",
      ring_level: 1,
    })
    .select("id")
    .maybeSingle();
  assert(!fmErr, `service insert youtube featured_messages (null user_id) ${fmErr?.message ?? ""}`);

  console.log("\n=== 3. viewer_scores participant_key keying ===");
  const { error: vs1 } = await admin.from("viewer_scores").insert({
    stream_id: streamId,
    user_id: null,
    origin: "youtube",
    external_author_id: TEST_EXT,
    total_score: 12,
    features_count: 1,
  });
  assert(!vs1, `first youtube viewer_scores insert ${vs1?.message ?? ""}`);
  const { data: vsRow } = await admin
    .from("viewer_scores")
    .select("participant_key")
    .eq("stream_id", streamId)
    .eq("external_author_id", TEST_EXT)
    .maybeSingle();
  assert(
    vsRow?.participant_key === `youtube:${TEST_EXT}`,
    `participant_key generated as youtube:${TEST_EXT} (got ${vsRow?.participant_key})`
  );
  const { error: vs2 } = await admin.from("viewer_scores").insert({
    stream_id: streamId,
    user_id: null,
    origin: "youtube",
    external_author_id: TEST_EXT,
    total_score: 99,
    features_count: 2,
  });
  assert(
    !!vs2 && vs2.code === "23505",
    `duplicate participant insert rejected by PK (${vs2?.code ?? "ALLOWED"})`
  );

  console.log("\n=== 4. RLS: anon read ok, anon insert denied ===");
  const { error: readErr } = await anon
    .from("featured_messages")
    .select("id")
    .limit(1);
  assert(!readErr, "anon can read featured_messages");
  const { error: anonIns } = await anon.from("featured_messages").insert({
    stream_id: streamId,
    origin: "youtube",
    external_author_id: TEST_EXT,
    score: 1,
    ring_level: 1,
  });
  assert(
    !!anonIns && anonIns.code === "42501",
    `anon insert denied (${anonIns?.code ?? "ALLOWED"})`
  );

  console.log("\n=== 5. cleanup ===");
  if (fm?.id) await admin.from("featured_messages").delete().eq("id", fm.id);
  await admin
    .from("viewer_scores")
    .delete()
    .eq("stream_id", streamId)
    .eq("external_author_id", TEST_EXT);
  console.log("  cleaned up");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
