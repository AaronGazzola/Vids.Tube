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
      title: "E2E tts verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true, tts_mode: "suggest" });

  const { error: cooldownError } = await admin
    .from("chat_commands")
    .update({ cooldown_s: 1 })
    .eq("channel_id", channel.id)
    .eq("keyword", "tts");
  if (cooldownError) fail(cooldownError.message);

  console.log(`STREAM_ID=${stream!.id}`);
}

async function post(body: string) {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  const { error } = await admin.from("chat_messages").insert({
    stream_id: argStreamId,
    user_id: channel.owner_user_id,
    body,
  });
  if (error) fail(error.message);
  ok(`posted ${JSON.stringify(body.slice(0, 40))}`);
}

async function setAuto() {
  if (!argStreamId) fail("stream id argument required");
  const { error } = await admin
    .from("chat_scoring_state")
    .update({ tts_mode: "auto" })
    .eq("stream_id", argStreamId);
  if (error) fail(error.message);
  ok("tts_mode set to auto");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const { data: rows, error } = await admin
    .from("tts_requests")
    .select("text, status, reason, audio_path")
    .eq("stream_id", argStreamId)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);

  const suggested = (rows ?? []).filter((r) => r.status === "suggested");
  if (suggested.length !== 1 || !suggested[0].text.includes("hello there")) {
    fail(`suggest-mode row wrong: ${JSON.stringify(suggested)}`);
  }
  ok(`clean request in suggest mode -> suggested (reason: ${suggested[0].reason})`);

  const dismissed = (rows ?? []).filter((r) => r.status === "dismissed");
  if (dismissed.length !== 1) {
    fail(`expected 1 dismissed row, got ${JSON.stringify(dismissed)}`);
  }
  ok(`abusive request -> dismissed (reason: ${dismissed[0].reason})`);

  const approved = (rows ?? []).filter((r) => r.status === "approved");
  if (approved.length !== 1 || !approved[0].text.includes("auto mode")) {
    fail(`auto-mode row wrong: ${JSON.stringify(approved)}`);
  }
  if (approved[0].audio_path !== null && !process.env.ELEVENLABS_API_KEY) {
    fail("audio_path set without an ElevenLabs key?");
  }
  ok(
    `clean request in auto mode -> approved (audio_path: ${approved[0].audio_path ?? "pending, no key"})`
  );

  const { data: events } = await admin
    .from("command_events")
    .select("keyword, status, reply")
    .eq("stream_id", argStreamId)
    .eq("keyword", "tts")
    .order("created_at", { ascending: true });
  const executed = (events ?? []).filter((e) => e.status === "executed");
  const longReply = executed.find((e) => /max out at 200/.test(e.reply ?? ""));
  if (!longReply) fail("over-length request did not get the limit reply");
  ok("over-length request got the limit reply and created no row");
  const ackAwait = executed.find((e) => /approval/.test(e.reply ?? ""));
  const ackQueued = executed.find((e) => /queued/.test(e.reply ?? ""));
  if (!ackAwait || !ackQueued) {
    fail(`acks missing: ${JSON.stringify(executed.map((e) => e.reply))}`);
  }
  ok("suggest ack and auto ack replies recorded");
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin
    .from("chat_commands")
    .update({ cooldown_s: 180 })
    .eq("channel_id", channel.id)
    .eq("keyword", "tts");
  await admin.from("tts_requests").delete().eq("stream_id", argStreamId);
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post-clean") await post("!tts hello there friends, big love from the waiting room");
  else if (phase === "post-abusive") await post("!tts you are all worthless idiots and this streamer is trash");
  else if (phase === "post-long") await post(`!tts ${"a".repeat(250)}`);
  else if (phase === "post-auto") await post("!tts auto mode should queue this straight away");
  else if (phase === "set-auto") await setAuto();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: setup|post-clean|post-abusive|post-long|post-auto|set-auto|assert|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
