import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { deliverReply } from "../worker/lib/replies";

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
    .select("id, slug, owner_user_id")
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
      title: "E2E bot replies verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true });

  console.log(`STREAM_ID=${stream!.id}`);
}

async function post() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  const { error } = await admin.from("chat_messages").insert({
    stream_id: argStreamId,
    user_id: channel.owner_user_id,
    body: "!help",
  });
  if (error) fail(error.message);
  ok("posted !help from a vids.tube user");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");

  const { data: botRows, error } = await admin
    .from("chat_messages")
    .select("id, body, author_name, user_id, origin")
    .eq("stream_id", argStreamId)
    .eq("origin", "bot");
  if (error) fail(error.message);
  if ((botRows ?? []).length !== 1) {
    fail(`expected 1 bot reply row, got ${(botRows ?? []).length}`);
  }
  const bot = botRows![0];
  if (bot.author_name !== "VidsBot") fail(`bot author is ${bot.author_name}`);
  if (bot.user_id !== null) fail("bot row has a user_id");
  if (!bot.body.includes("/commands")) {
    fail(`bot reply body missing guide link: ${bot.body}`);
  }
  ok("VidsBot reply row exists in vids.tube chat with the help reply");

  const { count: scores } = await admin
    .from("score_events")
    .select("id", { count: "exact", head: true })
    .eq("stream_id", argStreamId);
  if (scores) fail(`bot/command rows were scored (${scores} score_events)`);
  ok("no score_events — bot reply and command excluded from scoring");

  if (process.env.NIGHTBOT_CHANNEL_SEND_TOKEN) {
    fail(
      "NIGHTBOT_CHANNEL_SEND_TOKEN is set; the skip-path assertion needs it unset"
    );
  }
  await deliverReply({
    streamId: argStreamId,
    origin: "youtube",
    text: "skip-path check",
  });
  ok("youtube reply path without a token resolves as a logged skip");
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("score_events").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post") await post();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: verify-bot-replies.ts setup|post <id>|assert <id>|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
