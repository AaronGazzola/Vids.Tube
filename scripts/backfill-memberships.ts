import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: owner, error: ownerErr } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerErr) throw new Error(ownerErr.message);
  if (!owner) throw new Error("no owner community channel found");
  const community = owner.id;

  const { data: links, error: linksErr } = await admin
    .from("youtube_links")
    .select("user_id")
    .not("verified_at", "is", null);
  if (linksErr) throw new Error(linksErr.message);

  for (const link of links ?? []) {
    const { data, error } = await admin.rpc("merge_youtube_identity", {
      p_user_id: link.user_id,
    });
    if (error) {
      console.error(`merge failed for ${link.user_id}:`, error.message);
      continue;
    }
    console.log(`merged ${link.user_id}:`, JSON.stringify(data));
  }

  const { data: channels, error: chErr } = await admin
    .from("channels")
    .select("id, owner_user_id, youtube_channel_id, merged_into_channel_id");
  if (chErr) throw new Error(chErr.message);

  let recomputed = 0;
  for (const ch of channels ?? []) {
    if (ch.id === community) continue;
    if (ch.merged_into_channel_id) continue;
    const { error } = await admin.rpc("recompute_membership", {
      p_channel_id: ch.id,
      p_community_channel_id: community,
    });
    if (error) {
      console.error(`recompute failed for ${ch.id}:`, error.message);
      continue;
    }
    recomputed += 1;
  }

  const { data: memberships } = await admin
    .from("memberships")
    .select("channel_id, lifetime_xp, level, credits, streams_attended, current_streak")
    .eq("community_channel_id", community);
  for (const m of memberships ?? []) {
    console.log(
      `membership ${m.channel_id}: xp=${m.lifetime_xp} lvl=${m.level} credits=${m.credits} streams=${m.streams_attended} streak=${m.current_streak}`
    );
  }
  console.log(
    `done: ${links?.length ?? 0} links merged, ${recomputed} channels recomputed, ${memberships?.length ?? 0} memberships in the owner community`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
