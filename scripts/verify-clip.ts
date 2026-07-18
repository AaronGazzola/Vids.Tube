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

const SNIPPET_TEXT = "We are shipping the clip marker feature right now.";

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
      title: "E2E clip verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
      started_at: new Date(Date.now() - 120_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true });
  await admin.from("transcript_segments").insert({
    stream_id: stream!.id,
    start_s: 0,
    end_s: 6,
    text: SNIPPET_TEXT,
  });

  console.log(`STREAM_ID=${stream!.id}`);
}

async function post() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  const { error } = await admin.from("chat_messages").insert({
    stream_id: argStreamId,
    user_id: channel.owner_user_id,
    body: "!clip",
  });
  if (error) fail(error.message);
  ok("posted !clip");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const { data: markers } = await admin
    .from("clip_markers")
    .select("stream_time_s, snippet, author_name")
    .eq("stream_id", argStreamId);
  if ((markers ?? []).length !== 1) {
    fail(`expected 1 marker, got ${(markers ?? []).length}`);
  }
  const m = markers![0];
  if (m.stream_time_s < 100 || m.stream_time_s > 600) {
    fail(`stream_time_s implausible: ${m.stream_time_s}`);
  }
  if (!m.snippet?.includes("clip marker feature")) {
    fail(`snippet missing transcript: ${m.snippet}`);
  }
  ok(`marker at ${m.stream_time_s}s with transcript snippet`);

  const { data: events } = await admin
    .from("command_events")
    .select("reply")
    .eq("stream_id", argStreamId)
    .eq("keyword", "clip")
    .eq("status", "executed");
  if (
    (events ?? []).length !== 1 ||
    !/clip marked at .*YouTube short/i.test(events![0].reply ?? "")
  ) {
    fail(`ack wrong: ${JSON.stringify(events)}`);
  }
  ok(`ack correct: ${events![0].reply}`);
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  await admin.from("clip_markers").delete().eq("stream_id", argStreamId);
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("transcript_segments").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post") await post();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: setup|post <id>|assert <id>|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
