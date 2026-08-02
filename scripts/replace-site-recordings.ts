import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const flag = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const SITE_PREFIX = "vod/owner/";
const SNAPSHOT_DIR = flag("--snapshot-dir") ?? ".snapshots";

type Stream = {
  id: string;
  started_at: string;
  live_at: string | null;
  title: string;
  youtube_video_id: string | null;
  channel_id: string;
};

async function siteRecordings() {
  const { data: videos, error } = await admin
    .from("videos")
    .select("id, source_stream_id, mp4_path, duration_s, status")
    .like("mp4_path", `${SITE_PREFIX}%`);
  if (error) throw new Error(error.message);
  const streamIds = (videos ?? []).map((v) => v.source_stream_id).filter(Boolean) as string[];
  const { data: streams, error: sErr } = await admin
    .from("streams")
    .select("id, started_at, live_at, title, youtube_video_id, channel_id")
    .in("id", streamIds);
  if (sErr) throw new Error(sErr.message);
  return { videos: videos ?? [], streams: (streams ?? []) as Stream[] };
}

async function main() {
  const { videos, streams } = await siteRecordings();
  const detachedPath = `${SNAPSHOT_DIR}/site-recordings-detached.json`;

  if (has("--detach")) {
    const withYoutube = streams.filter((s) => s.youtube_video_id);
    if (!withYoutube.length) {
      console.log("nothing to detach — no site recording still points at a YouTube copy");
      return;
    }
    writeFileSync(
      detachedPath,
      JSON.stringify(
        {
          takenAt: new Date().toISOString(),
          detached: withYoutube.map((s) => ({ id: s.id, youtube_video_id: s.youtube_video_id })),
        },
        null,
        2
      )
    );
    console.log(`detaching ${withYoutube.length} site recordings from their YouTube copies`);
    for (const s of withYoutube) {
      console.log(`  ${s.started_at.slice(0, 10)} ${s.youtube_video_id}`);
    }
    if (!has("--apply")) {
      console.log("\ndry run — nothing changed. add --apply.");
      return;
    }
    const { error } = await admin
      .from("streams")
      .update({ youtube_video_id: null })
      .in(
        "id",
        withYoutube.map((s) => s.id)
      );
    if (error) throw new Error(error.message);
    console.log(`detached. original values recorded in ${detachedPath}`);
    return;
  }

  if (has("--status")) {
    console.log(`site recordings still present: ${videos.length}`);
    for (const s of streams) {
      const v = videos.find((x) => x.source_stream_id === s.id);
      const { count: replacementCount } = await admin
        .from("streams")
        .select("*", { count: "exact", head: true })
        .eq("youtube_video_id", await originalVideoId(s.id, detachedPath))
        .neq("id", s.id);
      console.log(
        `  ${s.started_at.slice(0, 10)} ${v?.duration_s}s ${v?.mp4_path} replacement=${replacementCount ?? 0}`
      );
    }
    return;
  }

  if (has("--delete")) {
    const detached = readDetached(detachedPath);
    const plan: { stream: Stream; videoId: string; replacementStream: string; replacementVideo: string }[] = [];
    for (const s of streams) {
      const ytid = detached[s.id] ?? s.youtube_video_id;
      if (!ytid) {
        throw new Error(`no YouTube copy recorded for the ${s.started_at.slice(0, 10)} broadcast`);
      }
      const { data: repl } = await admin
        .from("streams")
        .select("id")
        .eq("youtube_video_id", ytid)
        .neq("id", s.id)
        .maybeSingle();
      if (!repl) {
        throw new Error(`no replacement broadcast exists for ${ytid} — refusing to delete`);
      }
      const { data: replVideo } = await admin
        .from("videos")
        .select("id, status, mp4_path")
        .eq("source_stream_id", repl.id)
        .maybeSingle();
      if (!replVideo || replVideo.status !== "ready" || !replVideo.mp4_path) {
        throw new Error(`replacement for ${ytid} has no ready video — refusing to delete`);
      }
      plan.push({
        stream: s,
        videoId: ytid,
        replacementStream: repl.id,
        replacementVideo: replVideo.id,
      });
    }

    console.log(`site recordings to delete: ${plan.length}`);
    for (const p of plan) {
      const v = videos.find((x) => x.source_stream_id === p.stream.id);
      console.log(
        `  ${p.stream.started_at.slice(0, 10)} ${v?.duration_s}s ${v?.mp4_path} -> replaced by ${p.videoId}`
      );
    }
    console.log("\nstorage files are left in place; only catalogue rows are removed.");

    if (!has("--apply")) {
      console.log("\ndry run — nothing changed. add --apply.");
      return;
    }

    for (const p of plan) {
      const v = videos.find((x) => x.source_stream_id === p.stream.id);
      if (v) {
        const { error } = await admin.from("videos").delete().eq("id", v.id);
        if (error) throw new Error(`video delete failed: ${error.message}`);
      }
      const { error: sErr } = await admin.from("streams").delete().eq("id", p.stream.id);
      if (sErr) throw new Error(`broadcast delete failed: ${sErr.message}`);
      console.log(`deleted ${p.stream.started_at.slice(0, 10)} (${p.videoId})`);
    }

    const { videos: leftovers } = await siteRecordings();
    console.log(`\nsite recordings remaining in the catalogue: ${leftovers.length}`);
    return;
  }

  console.log("pass one of --detach, --status or --delete (add --apply to write)");
}

async function originalVideoId(streamId: string, path: string) {
  const detached = readDetached(path);
  return detached[streamId] ?? "";
}

function readDetached(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { detached: { id: string; youtube_video_id: string }[] };
    return Object.fromEntries(parsed.detached.map((d) => [d.id, d.youtube_video_id]));
  } catch {
    return {};
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
