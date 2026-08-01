import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const OWNER_CHANNEL_SLUG = "azanything";
const APPLY = process.argv.includes("--apply");
const SNAPSHOT = process.argv.includes("--snapshot")
  ? process.argv[process.argv.indexOf("--snapshot") + 1]
  : "misfiled-broadcasts-snapshot.json";

const STREAM_SCOPED_CHANNEL_TABLES = [
  "ask_requests",
  "command_events",
  "tts_requests",
] as const;

async function resolveOwnerChannel() {
  const { data, error } = await admin
    .from("channels")
    .select("id, slug")
    .eq("slug", OWNER_CHANNEL_SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`owner channel @${OWNER_CHANNEL_SLUG} not found`);
  return data;
}

async function main() {
  const owner = await resolveOwnerChannel();

  const { data: strays, error: strayErr } = await admin
    .from("streams")
    .select("id, channel_id, started_at, youtube_video_id, title, status")
    .neq("channel_id", owner.id)
    .not("youtube_video_id", "is", null)
    .order("started_at", { ascending: true });
  if (strayErr) throw new Error(strayErr.message);

  if (!strays || strays.length === 0) {
    console.log("no misfiled broadcasts found");
    return;
  }

  const streamIds = strays.map((s) => s.id);
  const wrongChannelIds = [...new Set(strays.map((s) => s.channel_id))];
  const { data: wrongChannels } = await admin
    .from("channels")
    .select("id, slug, owner_user_id")
    .in("id", wrongChannelIds);

  const { data: vids, error: vidErr } = await admin
    .from("videos")
    .select("id, channel_id, source_stream_id, title, status, mp4_path")
    .in("source_stream_id", streamIds);
  if (vidErr) throw new Error(vidErr.message);

  const { data: orphanVids } = await admin
    .from("videos")
    .select("id, channel_id, source_stream_id, title, status")
    .in("channel_id", wrongChannelIds);

  const extra: Record<string, unknown[]> = {};
  for (const table of STREAM_SCOPED_CHANNEL_TABLES) {
    const { data } = await admin.from(table).select("*").in("stream_id", streamIds);
    if (data && data.length) extra[table] = data;
  }

  const snapshot = {
    takenAt: new Date().toISOString(),
    ownerChannel: owner,
    wrongChannels,
    streams: strays,
    videos: vids ?? [],
    videosOnWrongChannel: orphanVids ?? [],
    streamScopedRows: extra,
  };
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));

  const bySlug = new Map((wrongChannels ?? []).map((c) => [c.id, c.slug]));
  console.log(`owner channel: @${owner.slug} (${owner.id})`);
  console.log(`snapshot written to ${SNAPSHOT}`);
  console.log(`\nmisfiled broadcasts: ${strays.length}`);
  for (const s of strays) {
    console.log(
      `  ${s.started_at?.slice(0, 10)}  @${bySlug.get(s.channel_id)}  yt=${s.youtube_video_id}  ${s.title?.slice(0, 40)}`
    );
  }
  console.log(`\nvideos attached to those broadcasts: ${vids?.length ?? 0}`);
  const videosNeedingMove = (vids ?? []).filter((v) => v.channel_id !== owner.id);
  console.log(`videos needing a channel change: ${videosNeedingMove.length}`);
  const strandedVideos = (orphanVids ?? []).filter(
    (v) => !v.source_stream_id || !streamIds.includes(v.source_stream_id)
  );
  console.log(`videos on the wrong channel with no misfiled broadcast: ${strandedVideos.length}`);
  for (const v of strandedVideos) {
    console.log(`  ${v.id} ${v.status} ${v.title?.slice(0, 50)} sourceStream=${v.source_stream_id ?? "none"}`);
  }
  for (const [table, rows] of Object.entries(extra)) {
    console.log(`${table} rows on those broadcasts: ${rows.length}`);
  }

  if (!APPLY) {
    console.log("\ndry run — nothing changed. re-run with --apply to move them.");
    return;
  }

  const { error: sErr, count: sCount } = await admin
    .from("streams")
    .update({ channel_id: owner.id }, { count: "exact" })
    .in("id", streamIds);
  if (sErr) throw new Error(`stream move failed: ${sErr.message}`);

  const videoIds = [...new Set([...(vids ?? []), ...strandedVideos].map((v) => v.id))];
  let vCount = 0;
  if (videoIds.length) {
    const { error: vErr, count } = await admin
      .from("videos")
      .update({ channel_id: owner.id }, { count: "exact" })
      .in("id", videoIds);
    if (vErr) throw new Error(`video move failed: ${vErr.message}`);
    vCount = count ?? 0;
  }

  for (const table of STREAM_SCOPED_CHANNEL_TABLES) {
    const rows = extra[table];
    if (!rows || !rows.length) continue;
    const { error } = await admin
      .from(table)
      .update({ channel_id: owner.id })
      .in("stream_id", streamIds);
    if (error) throw new Error(`${table} move failed: ${error.message}`);
    console.log(`${table}: ${rows.length} rows re-pointed`);
  }

  console.log(`\nmoved ${sCount ?? streamIds.length} broadcasts and ${vCount} videos to @${owner.slug}`);

  const { count: remaining } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .neq("channel_id", owner.id)
    .not("youtube_video_id", "is", null);
  const { count: remainingVideos } = await admin
    .from("videos")
    .select("*", { count: "exact", head: true })
    .neq("channel_id", owner.id);
  console.log(`verification: misfiled broadcasts remaining ${remaining}, videos off the owner channel ${remainingVideos}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
