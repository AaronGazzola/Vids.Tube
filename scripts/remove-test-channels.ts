import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");
const HANDLES = ["test", "test4"];

async function main() {
  const { data: channels, error } = await admin
    .from("channels")
    .select("id, handle, name, owner_user_id, youtube_channel_id")
    .in("handle", HANDLES);
  if (error) throw new Error(error.message);

  if (!channels?.length) {
    console.log("no test channels found — nothing to do");
    return;
  }

  for (const c of channels) {
    const { count: memberships } = await admin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", c.id);
    const { count: hosted } = await admin
      .from("streams")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", c.id);
    const { count: videos } = await admin
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", c.id);

    console.log(
      `${c.handle}: memberships=${memberships ?? 0} streams=${hosted ?? 0} videos=${videos ?? 0} youtube=${c.youtube_channel_id ?? "none"}`
    );

    // A test channel that has hosted a broadcast or holds a video is not the
    // throwaway this script is for; removing it would take real content with it.
    if ((hosted ?? 0) > 0 || (videos ?? 0) > 0) {
      console.error(
        `  refusing to remove ${c.handle}: it owns broadcasts or videos`
      );
      continue;
    }

    if (!APPLY) {
      console.log(`  would remove ${c.handle} (memberships cascade)`);
      continue;
    }

    const { error: delErr } = await admin.from("channels").delete().eq("id", c.id);
    if (delErr) {
      console.error(`  removal failed for ${c.handle}: ${delErr.message}`);
      continue;
    }
    console.log(`  removed ${c.handle}`);
  }

  const { data: owner } = await admin
    .from("channels")
    .select("id, handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (owner) {
    const { data: count } = await admin.rpc("community_member_count", {
      p_community: owner.id,
    });
    console.log(`\n@${owner.handle} member count: ${count}`);
  }

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply to write.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
