import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { isStreamEligible, resolveEligibleStream } from "../worker/lib/streams";

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
      title: "E2E prelive worker verify",
      scheduled_start_at: new Date(Date.now() + 1_800_000).toISOString(),
      waiting_room_chat: true,
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: stream!.id, enabled: true });

  await admin.from("chat_messages").insert([
    {
      stream_id: stream!.id,
      user_id: channel.owner_user_id,
      body: "pre-live check: the overlays look great already",
    },
    {
      stream_id: stream!.id,
      user_id: channel.owner_user_id,
      body: "counting down to the start, hyped for this one",
    },
    {
      stream_id: stream!.id,
      user_id: channel.owner_user_id,
      body: "will the leaderboard carry over from the waiting room?",
    },
  ]);

  const eligible = await resolveEligibleStream();
  if (!eligible || eligible.id !== stream!.id) {
    fail("dated public scheduled stream with scoring on is not resolved as eligible");
  }
  ok("dated public scheduled stream with scoring on resolves as eligible");
  if (!(await isStreamEligible(stream!.id))) {
    fail("isStreamEligible is false for the scheduled stream");
  }
  ok("isStreamEligible true for the scheduled stream");
  console.log(`STREAM_ID=${stream!.id}`);
}

async function postPhase() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();
  await admin.from("chat_messages").insert([
    {
      stream_id: argStreamId,
      user_id: channel.owner_user_id,
      body: "pre-live check: the overlays look great already",
    },
    {
      stream_id: argStreamId,
      user_id: channel.owner_user_id,
      body: "counting down to the start, hyped for this one",
    },
    {
      stream_id: argStreamId,
      user_id: channel.owner_user_id,
      body: "will the leaderboard carry over from the waiting room?",
    },
  ]);
  ok("posted 3 waiting-room messages while the worker is engaged");
}

async function assertPhase() {
  if (!argStreamId) fail("stream id argument required");
  const channel = await ownerChannel();

  const { data: hb } = await admin
    .from("worker_heartbeats")
    .select("last_heartbeat_at")
    .eq("channel_id", channel.id)
    .maybeSingle();
  if (!hb) fail("no worker heartbeat row");
  const ageMs = Date.now() - new Date(hb.last_heartbeat_at).getTime();
  if (ageMs > 120_000) fail(`heartbeat stale (${Math.round(ageMs / 1000)}s old)`);
  ok(`worker heartbeat updated ${Math.round(ageMs / 1000)}s ago`);

  const { count: scores } = await admin
    .from("score_events")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", argStreamId);
  if (!scores) fail("no score_events written for the pre-live stream");
  ok(`${scores} score_events written while the stream was scheduled (pre-live)`);

  const { count: segs } = await admin
    .from("transcript_segments")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", argStreamId);
  if (segs) fail(`transcript_segments written pre-live (${segs})`);
  ok("no transcript_segments written before live");

  const { count: mods } = await admin
    .from("moderation_actions")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", argStreamId);
  console.log(`INFO: moderation_actions rows: ${mods ?? 0} (content-dependent)`);
}

async function exclusions() {
  const channel = await ownerChannel();
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .in("status", ["draft", "scheduled", "preview", "live"]);
  if ((count ?? 0) > 0) fail("active stream rows exist; not safe to run");

  const { data: draft } = await admin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: "draft",
      created_in_ui: true,
      title: "E2E prelive draft exclusion",
    })
    .select("id")
    .single();
  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: draft!.id, enabled: true });
  const rDraft = await resolveEligibleStream();
  if (rDraft) fail("a draft stream was resolved as eligible");
  ok("draft stream is not engaged");
  await admin.from("streams").delete().eq("id", draft!.id);

  const nowIso = new Date().toISOString();
  const { data: adhoc } = await admin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: "preview",
      created_in_ui: false,
      started_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("id")
    .single();
  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: adhoc!.id, enabled: true });
  const rAdhoc = await resolveEligibleStream();
  if (rAdhoc) fail("an ad-hoc (undated, private) preview was resolved as eligible");
  ok("ad-hoc private preview is not engaged");
  if (await isStreamEligible(adhoc!.id)) {
    fail("isStreamEligible true for ad-hoc preview");
  }
  ok("isStreamEligible false for ad-hoc preview");
  await admin.from("streams").delete().eq("id", adhoc!.id);
}

async function cleanup() {
  if (!argStreamId) fail("stream id argument required");
  await admin.from("chat_messages").delete().eq("stream_id", argStreamId);
  await admin.from("score_events").delete().eq("stream_id", argStreamId);
  await admin.from("featured_messages").delete().eq("stream_id", argStreamId);
  await admin.from("moderation_actions").delete().eq("stream_id", argStreamId);
  await admin.from("viewer_scores").delete().eq("stream_id", argStreamId);
  await admin.from("streams").delete().eq("id", argStreamId);
  ok("cleaned up");
}

async function main() {
  if (phase === "setup") await setup();
  else if (phase === "post") await postPhase();
  else if (phase === "assert") await assertPhase();
  else if (phase === "exclusions") await exclusions();
  else if (phase === "cleanup") await cleanup();
  else fail("usage: verify-prelive-worker.ts setup|assert <id>|exclusions|cleanup <id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
