import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");
const SNAPSHOT = process.argv.includes("--snapshot")
  ? process.argv[process.argv.indexOf("--snapshot") + 1]
  : "host-identity-snapshot.json";

async function main() {
  const { data: community, error: cErr } = await admin
    .from("channels")
    .select("id, slug, owner_user_id, youtube_channel_id")
    .not("owner_user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!community?.owner_user_id) {
    throw new Error("no owned channel found — cannot resolve the owner community");
  }
  const ownerUserId = community.owner_user_id;

  const { data: link, error: lErr } = await admin
    .from("youtube_links")
    .select("youtube_channel_id, youtube_handle, verified_at")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  if (lErr) throw new Error(lErr.message);
  if (!link) {
    throw new Error(`owner @${community.slug} has no youtube_links row — nothing to merge`);
  }
  if (!link.verified_at || !link.youtube_channel_id) {
    throw new Error(
      `owner @${community.slug} has an unverified YouTube link — the merge would be unsafe`
    );
  }
  const ycid = link.youtube_channel_id;

  const { data: duplicates } = await admin
    .from("channels")
    .select("id, slug, owner_user_id, merged_into_channel_id")
    .eq("youtube_channel_id", ycid)
    .neq("id", community.id);

  const before = await snapshotState(community.id, ownerUserId, ycid);
  writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), community, link, duplicates, before }, null, 2)
  );

  console.log(`owner community: @${community.slug}`);
  console.log(`owner YouTube account: ${link.youtube_handle} (${ycid})`);
  console.log(`community youtube_channel_id currently: ${community.youtube_channel_id ?? "not set"}`);
  console.log(`duplicate profiles holding that account: ${duplicates?.length ?? 0}`);
  for (const d of duplicates ?? []) {
    console.log(`  @${d.slug} owned=${d.owner_user_id ? "yes" : "no"} retired=${d.merged_into_channel_id ? "yes" : "no"}`);
  }
  console.log(`\nbefore: ${JSON.stringify(before)}`);
  console.log(`snapshot written to ${SNAPSHOT}`);

  if (!APPLY) {
    console.log("\ndry run — nothing changed. re-run with --apply to merge.");
    return;
  }

  const { data: result, error: mErr } = await admin.rpc("merge_youtube_identity", {
    p_user_id: ownerUserId,
  });
  if (mErr) throw new Error(`merge failed: ${mErr.message}`);
  const merged = result as { merged: boolean; reason?: string; communities?: number };
  console.log(`\nmerge result: ${JSON.stringify(merged)}`);
  if (!merged.merged) {
    throw new Error(`merge did not complete: ${merged.reason}`);
  }

  const { data: hostScores } = await admin
    .from("viewer_scores")
    .select("stream_id, participant_key")
    .or(`participant_key.eq.youtube:${ycid},participant_key.eq.${ownerUserId},external_author_id.eq.${ycid}`);
  if (hostScores?.length) {
    for (const row of hostScores) {
      const { error } = await admin
        .from("viewer_scores")
        .delete()
        .eq("stream_id", row.stream_id)
        .eq("participant_key", row.participant_key);
      if (error) throw new Error(`host score delete failed: ${error.message}`);
    }
  }
  console.log(`host viewer_scores rows deleted: ${hostScores?.length ?? 0}`);

  const after = await snapshotState(community.id, ownerUserId, ycid);
  console.log(`\nafter: ${JSON.stringify(after)}`);

  const failures: string[] = [];
  if (!after.communityYcid) failures.push("community channel still has no YouTube account recorded");
  if (after.tombstonedIntoCommunity !== 1) {
    failures.push(`expected exactly 1 retired profile, found ${after.tombstonedIntoCommunity}`);
  }
  if (after.unattributedHostMessages !== 0) {
    failures.push(`${after.unattributedHostMessages} host chat messages still unattributed`);
  }
  if (after.selfMemberships !== 0) failures.push(`${after.selfMemberships} self-memberships exist`);
  if (after.hostViewerScores !== 0) failures.push(`${after.hostViewerScores} host score rows remain`);

  if (failures.length) {
    console.error("\npost-conditions failed:");
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("\nall post-conditions passed");
}

async function snapshotState(communityId: string, ownerUserId: string, ycid: string) {
  const { data: comm } = await admin
    .from("channels")
    .select("youtube_channel_id")
    .eq("id", communityId)
    .maybeSingle();
  const { count: tombstoned } = await admin
    .from("channels")
    .select("*", { count: "exact", head: true })
    .eq("merged_into_channel_id", communityId);
  const { count: unattributed } = await admin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("external_author_id", ycid)
    .is("user_id", null);
  const { count: attributed } = await admin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", ownerUserId);
  const { count: hostScores } = await admin
    .from("viewer_scores")
    .select("*", { count: "exact", head: true })
    .or(`participant_key.eq.youtube:${ycid},participant_key.eq.${ownerUserId},external_author_id.eq.${ycid}`);
  const { data: mems } = await admin.from("memberships").select("channel_id, community_channel_id");
  const selfMemberships = (mems ?? []).filter((m) => m.channel_id === m.community_channel_id).length;
  const { count: totalMemberships } = await admin
    .from("memberships")
    .select("*", { count: "exact", head: true });
  const { count: totalChannels } = await admin
    .from("channels")
    .select("*", { count: "exact", head: true });

  return {
    communityYcid: comm?.youtube_channel_id ?? null,
    tombstonedIntoCommunity: tombstoned ?? 0,
    unattributedHostMessages: unattributed ?? 0,
    attributedToOwner: attributed ?? 0,
    hostViewerScores: hostScores ?? 0,
    selfMemberships,
    totalMemberships: totalMemberships ?? 0,
    totalChannels: totalChannels ?? 0,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
