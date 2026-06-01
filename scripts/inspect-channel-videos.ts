import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const slug = process.argv[2] ?? "owner";

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const { data: channel } = await admin
    .from("channels")
    .select("id, slug, name, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!channel) {
    console.error(`No channel with slug '${slug}'`);
    process.exit(1);
  }
  console.log(`Channel: ${channel.name} (slug=${channel.slug})`);
  console.log(`Owner user id: ${channel.owner_user_id}`);
  console.log();

  const { data: videos } = await admin
    .from("videos")
    .select(
      "id, status, title, created_at, published_at, mp4_path, thumbnail_path, width, height, preview_paths, source_stream_id"
    )
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false });

  if (!videos || videos.length === 0) {
    console.log("No videos at all for this channel.");
    return;
  }

  for (const v of videos) {
    console.log(`---`);
    console.log(`id:           ${v.id}`);
    console.log(`status:       ${v.status}`);
    console.log(`title:        ${v.title ?? "(none)"}`);
    console.log(`created_at:   ${v.created_at}`);
    console.log(`published_at: ${v.published_at ?? "(not yet)"}`);
    console.log(`mp4_path:     ${v.mp4_path ?? "(none)"}`);
    console.log(`thumb_path:   ${v.thumbnail_path ?? "(none)"}`);
    console.log(`width/height: ${v.width ?? "null"} x ${v.height ?? "null"}`);
    console.log(`previews:     ${v.preview_paths?.length ?? 0} stills`);
    console.log(`source_stream:${v.source_stream_id ?? "(none)"}`);
  }

  const { data: streams } = await admin
    .from("streams")
    .select("id, status, title, started_at, ended_at, last_seen_at")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(3);

  console.log();
  console.log(`Recent streams (${streams?.length ?? 0}):`);
  for (const s of streams ?? []) {
    console.log(
      `  ${s.status.padEnd(10)} ${s.title ?? "(no title)"} | started=${s.started_at ?? "-"} ended=${s.ended_at ?? "-"} last_seen=${s.last_seen_at ?? "-"}`
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
