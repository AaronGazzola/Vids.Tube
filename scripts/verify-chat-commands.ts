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
      title: "E2E chat commands verify",
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
  const bodies = [
    "!help",
    "!help",
    "!nope",
    "!nope",
    "the commands layer should ignore this normal message",
  ];
  for (const body of bodies) {
    const { error } = await admin.from("chat_messages").insert({
      stream_id: argStreamId,
      user_id: channel.owner_user_id,
      body,
    });
    if (error) fail(error.message);
  }
  ok("posted !help x2, !nope x2, and one normal message");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();

  const { data: events, error } = await admin
    .from("command_events")
    .select("keyword, status, reply, chat_message_id")
    .eq("stream_id", argStreamId)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);

  const executed = (events ?? []).filter(
    (e) => e.keyword === "help" && e.status === "executed"
  );
  if (executed.length !== 1) {
    fail(`expected 1 executed help event, got ${executed.length}`);
  }
  const guideUrl = `/${channel.slug}/commands`;
  if (!executed[0].reply?.includes(guideUrl)) {
    fail(`help reply missing guide URL (${executed[0].reply})`);
  }
  ok(`!help executed once with reply containing ${guideUrl}`);

  const cooled = (events ?? []).filter(
    (e) => e.keyword === "help" && e.status === "cooldown"
  );
  if (cooled.length !== 1) {
    fail(`expected 1 cooldown help event, got ${cooled.length}`);
  }
  ok("repeat !help inside the cooldown logged as cooldown");

  const unknown = (events ?? []).filter((e) => e.status === "unknown");
  if (unknown.length !== 1 || unknown[0].keyword !== "nope") {
    fail(
      `expected exactly 1 unknown event for nope, got ${JSON.stringify(unknown)}`
    );
  }
  if (!unknown[0].reply?.includes("!help")) {
    fail("unknown reply does not point to !help");
  }
  ok("unknown !nope logged once with a pointer to !help; repeat was silent");

  const { data: commandMessages } = await admin
    .from("chat_messages")
    .select("id, body")
    .eq("stream_id", argStreamId)
    .like("body", "!%");
  const ids = (commandMessages ?? []).map((m) => m.id);
  const { count: scored } = await admin
    .from("score_events")
    .select("id", { count: "exact", head: true })
    .eq("stream_id", argStreamId);
  const { data: scoreEvents } = await admin
    .from("score_events")
    .select("metadata")
    .eq("stream_id", argStreamId);
  const scoredCommandRef = JSON.stringify(scoreEvents ?? []).match(
    /!(help|nope)/
  );
  if (scoredCommandRef) {
    fail("a command message leaked into scoring");
  }
  ok(
    `command messages excluded from scoring (${ids.length} command rows, ${scored ?? 0} score_events from normal chat only)`
  );
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("score_events").delete().eq("stream_id", argStreamId);
  await admin.from("featured_messages").delete().eq("stream_id", argStreamId);
  await admin.from("viewer_scores").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post") await post();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: verify-chat-commands.ts setup|post <id>|assert <id>|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
