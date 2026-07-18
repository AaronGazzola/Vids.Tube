import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const phase = process.argv[2];
const argStreamId = process.argv[3];

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`OK: ${msg}`);
}

async function ownerChannel() {
  const { data } = await admin
    .from("channels")
    .select("id, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) fail("no channel");
  return data;
}

async function setup() {
  const channel = await ownerChannel();
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .in("status", ["draft", "scheduled", "preview", "live"]);
  if ((count ?? 0) > 0) fail("active stream rows exist; not safe to run");

  const { data: stream, error } = await admin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: "scheduled",
      created_in_ui: true,
      title: "E2E bot moments verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin.from("chat_scoring_state").insert({
    stream_id: stream!.id,
    enabled: true,
    useful_info_enabled: true,
    competition_status_enabled: true,
    progress_update_enabled: true,
    wrapup_mvp_enabled: true,
    wrapup_summary_enabled: true,
    wrapup_thanks_enabled: true,
  });

  const { error: scoresError } = await admin.from("viewer_scores").insert([
    {
      stream_id: stream!.id,
      external_author_id: "UC_MOMENTS_A",
      origin: "youtube",
      author_name: "MomentFan",
      total_score: 42,
      features_count: 1,
    },
  ]);
  if (scoresError) fail(scoresError.message);

  await admin.from("transcript_segments").insert([
    {
      stream_id: stream!.id,
      start_s: 0,
      end_s: 8,
      text: "Today we shipped the whole bot moments system and it went really smoothly.",
    },
    {
      stream_id: stream!.id,
      start_s: 8,
      end_s: 16,
      text: "I wonder how many seconds there are in a full day, off the top of my head.",
    },
  ]);

  await admin.from("channel_projects").insert([
    {
      channel_id: channel.id,
      name: "MomentsTestProject",
      blurb: "an e2e fixture",
      domain_url: "https://vids.tube",
      repo_url: "https://github.com/example/vids",
      sort_order: 99,
    },
  ]);

  console.log(`STREAM_ID=${stream!.id}`);
}

async function requestWrapup() {
  if (!argStreamId) fail("stream id argument required");
  const { error } = await admin
    .from("streams")
    .update({ wrapup_requested_at: new Date().toISOString() })
    .eq("id", argStreamId);
  if (error) fail(error.message);
  ok("wrap-up requested");
}

async function botBodies(streamId: string): Promise<string[]> {
  const { data } = await admin
    .from("chat_messages")
    .select("body")
    .eq("stream_id", streamId)
    .eq("origin", "bot")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => r.body);
}

async function assertProactive() {
  if (!argStreamId) fail("stream id argument required");
  const bodies = await botBodies(argStreamId);

  const competition = bodies.find((b) => b.startsWith("Leaderboard check:"));
  if (!competition || !competition.includes("MomentFan (42)")) {
    fail(`competition post missing/wrong: ${JSON.stringify(bodies)}`);
  }
  ok(`competition status posted: ${competition}`);

  const progress = bodies.find((b) => b.startsWith("Currently building:"));
  if (
    !progress ||
    !progress.includes("MomentsTestProject") ||
    !progress.includes("https://vids.tube")
  ) {
    fail(`progress post missing/wrong: ${progress}`);
  }
  ok(`progress update posted with links: ${progress}`);

  const useful = bodies.find((b) => b.startsWith("Heard you wondering"));
  if (!useful || !/86[,.]?400/.test(useful)) {
    fail(`useful info missing/wrong: ${useful}`);
  }
  ok(`useful info answered the musing: ${useful}`);
}

async function assertWrapup() {
  if (!argStreamId) fail("stream id argument required");
  const bodies = await botBodies(argStreamId);

  const mvp = bodies.find((b) => b.startsWith("MVP of the stream:"));
  if (!mvp || !mvp.includes("MomentFan") || !mvp.includes("42")) {
    fail(`mvp message missing/wrong: ${mvp}`);
  }
  ok(`mvp sent: ${mvp}`);

  const thanks = bodies.find((b) => b.startsWith("Thanks for watching"));
  if (!thanks || !thanks.includes("MomentsTestProject")) {
    fail(`thanks message missing/wrong: ${thanks}`);
  }
  ok(`thanks sent with projects: ${thanks}`);

  const known = bodies.filter(
    (b) =>
      b.startsWith("MVP of the stream:") ||
      b.startsWith("Thanks for watching") ||
      b.startsWith("Leaderboard check:") ||
      b.startsWith("Currently building:") ||
      b.startsWith("Heard you wondering")
  );
  const summary = bodies.filter((b) => !known.includes(b));
  if (summary.length !== 1 || summary[0].length > 400) {
    fail(`expected exactly 1 summary message <=400 chars: ${JSON.stringify(summary)}`);
  }
  ok(`achievement summary sent: ${summary[0].slice(0, 80)}…`);

  const { data: row } = await admin
    .from("streams")
    .select("wrapup_done_at")
    .eq("id", argStreamId)
    .single();
  if (!row?.wrapup_done_at) fail("wrapup_done_at not stamped");
  ok("wrap-up stamped done (idempotent)");

  const mvpCount = bodies.filter((b) => b.startsWith("MVP of the stream:")).length;
  if (mvpCount !== 1) fail(`wrap-up ran ${mvpCount} times`);
  ok("wrap-up ran exactly once");
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin
    .from("channel_projects")
    .delete()
    .eq("channel_id", channel.id)
    .eq("name", "MomentsTestProject");
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("viewer_scores").delete().eq("stream_id", argStreamId);
  await admin.from("transcript_segments").delete().eq("stream_id", argStreamId);
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "request-wrapup") await requestWrapup();
  else if (phase === "assert-proactive") await assertProactive();
  else if (phase === "assert-wrapup") await assertWrapup();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: setup|request-wrapup|assert-proactive|assert-wrapup|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
