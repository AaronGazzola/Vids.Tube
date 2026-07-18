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

const PC_RESPONSE = "A Ryzen 9 with 64GB of RAM and three monitors";

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
      title: "E2E ai commands verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true, ask_mode: "suggest" });

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
  await admin
    .from("chat_commands")
    .update({ cooldown_s: 1 })
    .eq("channel_id", channel.id)
    .in("keyword", ["ask", "catchup"]);

  await admin.from("transcript_segments").insert([
    {
      stream_id: stream!.id,
      start_s: 0,
      end_s: 8,
      text: "Welcome back everyone, today we are wiring the chat bot into the overlay stack.",
    },
    {
      stream_id: stream!.id,
      start_s: 8,
      end_s: 16,
      text: "We just fixed the content security policy so the text to speech audio can play.",
    },
  ]);

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
  ok(`posted ${JSON.stringify(body.slice(0, 44))}`);
}

async function approveFirst() {
  if (!argStreamId) fail("stream id argument required");
  const { data } = await admin
    .from("ask_requests")
    .select("id")
    .eq("stream_id", argStreamId)
    .eq("status", "suggested")
    .limit(1)
    .maybeSingle();
  if (!data) fail("no suggested ask to approve");
  const { error } = await admin
    .from("ask_requests")
    .update({
      status: "approved",
      include_answer: true,
      approved_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) fail(error.message);
  ok("approved the suggested ask with includeAnswer");
}

async function setAuto() {
  if (!argStreamId) fail("stream id argument required");
  const { error } = await admin
    .from("chat_scoring_state")
    .update({ ask_mode: "auto" })
    .eq("stream_id", argStreamId);
  if (error) fail(error.message);
  ok("ask_mode set to auto");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const { data: asks } = await admin
    .from("ask_requests")
    .select("question, answer, status, reason, include_answer, answer_delivered_at")
    .eq("stream_id", argStreamId)
    .order("created_at", { ascending: true });

  const suggestedOrApproved = (asks ?? []).filter((a) =>
    ["approved", "shown"].includes(a.status)
  );
  const firstAsk = suggestedOrApproved.find((a) =>
    a.question.includes("what pc")
  );
  if (!firstAsk) fail(`grounded suggest ask missing: ${JSON.stringify(asks)}`);
  if (!/Ryzen|64GB|monitor/i.test(firstAsk.answer ?? "")) {
    fail(`answer not grounded in FAQ: ${firstAsk.answer}`);
  }
  if (!firstAsk.answer_delivered_at) {
    fail("approved ask answer was not delivered by the worker sweep");
  }
  ok(`grounded ask answered from FAQ and delivered: ${firstAsk.answer}`);

  const dismissed = (asks ?? []).filter((a) => a.status === "dismissed");
  if (dismissed.length !== 1) {
    fail(`expected 1 dismissed ask, got ${dismissed.length}`);
  }
  ok(`abusive ask dismissed silently (${dismissed[0].reason})`);

  const autoAsk = (asks ?? []).find((a) => a.question.includes("policy"));
  if (!autoAsk || !["approved", "shown"].includes(autoAsk.status)) {
    fail(`auto-mode ask wrong: ${JSON.stringify(autoAsk)}`);
  }
  ok(`auto-mode ask approved immediately: ${autoAsk.answer}`);

  const { data: events } = await admin
    .from("command_events")
    .select("keyword, status, reply")
    .eq("stream_id", argStreamId)
    .order("created_at", { ascending: true });
  const askEvents = (events ?? []).filter(
    (e) => e.keyword === "ask" && e.status === "executed"
  );
  const cantAnswer = askEvents.find((e) =>
    /don't have that one/.test(e.reply ?? "")
  );
  if (!cantAnswer) fail("ungroundable ask did not get the can't-answer reply");
  ok("ungroundable ask got the can't-answer reply");

  const catchupEvents = (events ?? []).filter(
    (e) => e.keyword === "catchup" && e.status === "executed"
  );
  if (catchupEvents.length !== 2) {
    fail(`expected 2 catchup executions, got ${catchupEvents.length}`);
  }
  const [c1, c2] = catchupEvents;
  if (!c1.reply || c1.reply.length > 400) {
    fail(`catchup reply bad: ${c1.reply}`);
  }
  if (c1.reply !== c2.reply) {
    fail("second catchup differed — cache miss");
  }
  ok(`catchup summarized (<=400 chars) and cached: ${c1.reply?.slice(0, 80)}…`);
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin
    .from("chat_commands")
    .update({ cooldown_s: 120 })
    .eq("channel_id", channel.id)
    .eq("keyword", "ask");
  await admin
    .from("chat_commands")
    .update({ cooldown_s: 60 })
    .eq("channel_id", channel.id)
    .eq("keyword", "catchup");
  await admin
    .from("chat_commands")
    .delete()
    .eq("channel_id", channel.id)
    .eq("keyword", "pc");
  await admin.from("ask_requests").delete().eq("stream_id", argStreamId);
  await admin.from("command_events").delete().eq("stream_id", argStreamId);
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("transcript_segments").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post-grounded") await post("!ask what pc do you use for streaming?");
  else if (phase === "post-abusive") await post("!ask why is this streamer such a talentless loser?");
  else if (phase === "post-ungrounded") await post("!ask what is the capital of mongolia?");
  else if (phase === "post-auto") await post("!ask what did you fix with the content security policy?");
  else if (phase === "post-catchup") await post("!catchup");
  else if (phase === "approve-first") await approveFirst();
  else if (phase === "set-auto") await setAuto();
  else if (phase === "assert") await assertPhase();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: setup|post-*|approve-first|set-auto|assert|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
