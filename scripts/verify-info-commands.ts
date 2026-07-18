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
    .select("id, slug, owner_user_id, handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) fail("no channel");
  return data;
}

const PC_RESPONSE = "Ryzen 9 + 64GB RAM + way too many monitors";

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
      title: "E2E info commands verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true });

  await admin.from("chat_commands").upsert(
    {
      channel_id: channel.id,
      keyword: "pc",
      kind: "custom",
      description: "The streaming rig",
      response: PC_RESPONSE,
      cooldown_s: 5,
      sort_order: 100,
    },
    { onConflict: "channel_id,keyword" }
  );

  const { error: scoresError } = await admin.from("viewer_scores").insert([
    {
      stream_id: stream!.id,
      user_id: channel.owner_user_id,
      origin: "vidstube",
      total_score: 12,
      features_count: 1,
    },
    {
      stream_id: stream!.id,
      external_author_id: "UC_INFO_A",
      origin: "youtube",
      author_name: "AlphaFan",
      total_score: 30,
      features_count: 2,
    },
    {
      stream_id: stream!.id,
      external_author_id: "UC_INFO_B",
      origin: "youtube",
      author_name: "BetaFan",
      total_score: 21,
      features_count: 0,
    },
  ]);
  if (scoresError) fail(`viewer_scores seed failed: ${scoresError.message}`);

  console.log(`STREAM_ID=${stream!.id}`);
}

async function post() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  for (const body of ["!pc", "!rank", "!top", "!uptime", "!goal"]) {
    const { error } = await admin.from("chat_messages").insert({
      stream_id: argStreamId,
      user_id: channel.owner_user_id,
      body,
    });
    if (error) fail(error.message);
  }
  ok("posted !pc !rank !top !uptime !goal");
}

async function disablePc() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin
    .from("streams")
    .update({ disabled_commands: ["pc"] })
    .eq("id", argStreamId);
  const { error } = await admin.from("chat_messages").insert({
    stream_id: argStreamId,
    user_id: channel.owner_user_id,
    body: "!pc",
  });
  if (error) fail(error.message);
  ok("disabled pc for the stream and posted !pc again");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const { data: events, error } = await admin
    .from("command_events")
    .select("keyword, status, reply")
    .eq("stream_id", argStreamId)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);

  const byKeyword = (k: string, s: string) =>
    (events ?? []).filter((e) => e.keyword === k && e.status === s);

  const pc = byKeyword("pc", "executed");
  if (pc.length !== 1 || pc[0].reply !== PC_RESPONSE) {
    fail(`custom !pc wrong: ${JSON.stringify(pc)}`);
  }
  ok("custom !pc replied with its stored response");

  const rank = byKeyword("rank", "executed");
  if (rank.length !== 1 || !/#3 of 3 with 12 points/.test(rank[0].reply ?? "")) {
    fail(`!rank wrong: ${JSON.stringify(rank)}`);
  }
  ok(`!rank correct: ${rank[0].reply}`);

  const top = byKeyword("top", "executed");
  if (
    top.length !== 1 ||
    !/AlphaFan \(30\)/.test(top[0].reply ?? "") ||
    !/BetaFan \(21\)/.test(top[0].reply ?? "")
  ) {
    fail(`!top wrong: ${JSON.stringify(top)}`);
  }
  ok(`!top correct: ${top[0].reply}`);

  const uptime = byKeyword("uptime", "executed");
  if (uptime.length !== 1 || !/Not live yet/.test(uptime[0].reply ?? "")) {
    fail(`!uptime wrong: ${JSON.stringify(uptime)}`);
  }
  ok(`!uptime correct: ${uptime[0].reply}`);

  const goal = byKeyword("goal", "executed");
  if (goal.length !== 1 || !/No goals are set up/.test(goal[0].reply ?? "")) {
    fail(`!goal wrong: ${JSON.stringify(goal)}`);
  }
  ok(`!goal degrades correctly: ${goal[0].reply}`);

  const disabled = byKeyword("pc", "disabled");
  if (disabled.length !== 1) {
    fail(`expected 1 disabled pc event, got ${disabled.length}`);
  }
  ok("per-stream exclusion logged !pc as disabled");
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("viewer_scores").delete().eq("stream_id", argStreamId);
  await admin.from("score_events").delete().eq("stream_id", argStreamId);
  await admin
    .from("chat_commands")
    .delete()
    .eq("channel_id", channel.id)
    .eq("keyword", "pc");
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post") await post();
  else if (phase === "disable-pc") await disablePc();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: setup|post <id>|disable-pc <id>|assert <id>|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
