import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  throw new Error(msg);
}
function ok(msg: string) {
  console.log(`OK: ${msg}`);
}
function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
  ok(`${label} = ${actual}`);
}

const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const YCID = `UC_MERGE_TEST_${suffix}`;
const YCID2 = `UC_MERGE_TEST2_${suffix}`;

async function mkUser(tag: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `merge-test-${tag}-${suffix}@example.invalid`,
    password: `pw-${suffix}-${tag}`,
    email_confirm: true,
  });
  if (error || !data.user) fail(`createUser ${tag}: ${error?.message}`);
  return data.user!.id;
}

async function main() {
  const uSurvivor = await mkUser("survivor");
  const uCommunity = await mkUser("community");
  const uOther = await mkUser("other");
  const uX = await mkUser("x");
  const createdUsers = [uSurvivor, uCommunity, uOther, uX];
  const orphanChannels: string[] = [];

  try {
    // Community channel + one ended stream.
    const { data: community } = await admin
      .from("channels")
      .insert({
        owner_user_id: uCommunity,
        slug: `mtest_comm_${suffix}`,
        handle: `mtest_comm_${suffix}`.slice(0, 30),
        name: "Merge Test Community",
      })
      .select("id")
      .single();
    const communityId = community!.id;

    const { data: stream } = await admin
      .from("streams")
      .insert({
        channel_id: communityId,
        status: "ended",
        title: "Merge Test Stream",
        started_at: new Date(Date.now() - 3600_000).toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const streamId = stream!.id;

    // Survivor channel (claimed) + source channel (unclaimed, holds YCID).
    const { data: survivorCh } = await admin
      .from("channels")
      .insert({
        owner_user_id: uSurvivor,
        slug: `mtest_surv_${suffix}`,
        handle: `mtest_surv_${suffix}`.slice(0, 30),
        name: "Survivor",
      })
      .select("id")
      .single();
    const survivorId = survivorCh!.id;

    const { data: sourceCh } = await admin
      .from("channels")
      .insert({
        slug: `mtest_src_${suffix}`,
        handle: `mtest_src_${suffix}`.slice(0, 30),
        name: "Unclaimed Source",
        youtube_channel_id: YCID,
      })
      .select("id")
      .single();
    const sourceId = sourceCh!.id;
    orphanChannels.push(sourceId);

    // Verified link: survivor user owns YCID.
    await admin.from("youtube_links").upsert(
      {
        user_id: uSurvivor,
        youtube_channel_id: YCID,
        youtube_handle: `mtest_${suffix}`,
        verify_code: "TESTAA",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Raw events in the stream: a vidstube identity (survivor) and the YouTube
    // identity (YCID), both active in the SAME stream.
    await admin.from("chat_messages").insert([
      { stream_id: streamId, user_id: uSurvivor, origin: "vidstube", body: "hi from vidstube" },
      { stream_id: streamId, user_id: null, origin: "youtube", external_author_id: YCID, author_name: "YT Me", body: "hi from youtube" },
    ]);
    await admin.from("score_events").insert([
      { stream_id: streamId, user_id: uSurvivor, origin: "vidstube", type: "highlight", points: 10 },
      { stream_id: streamId, user_id: null, origin: "youtube", external_author_id: YCID, type: "highlight", points: 5 },
    ]);
    await admin.from("viewer_scores").insert([
      { stream_id: streamId, user_id: uSurvivor, origin: "vidstube", total_score: 10, features_count: 0 },
      { stream_id: streamId, user_id: null, origin: "youtube", external_author_id: YCID, total_score: 5, features_count: 1, author_name: "YT Me" },
    ]);
    await admin.from("featured_messages").insert({
      stream_id: streamId,
      user_id: null,
      origin: "youtube",
      external_author_id: YCID,
      author_name: "YT Me",
      score: 5,
      ring_level: 1,
    });

    // Interaction rows keyed by the youtube participant key.
    await admin.from("command_events").insert({
      channel_id: communityId,
      stream_id: streamId,
      origin: "youtube",
      participant_key: `youtube:${YCID}`,
      keyword: "me",
      status: "executed",
    });
    await admin.from("banned_participants").insert({
      channel_id: communityId,
      participant_key: `youtube:${YCID}`,
      origin: "youtube",
      external_author_id: YCID,
      author_name: "YT Me",
    });

    // Membership collision: both source and survivor hold memberships with credits.
    await admin.from("memberships").insert([
      { channel_id: sourceId, community_channel_id: communityId, credits: 20 },
      { channel_id: survivorId, community_channel_id: communityId, credits: 30 },
    ]);

    // --- Run the merge ---
    const { data: mergeRes, error: mergeErr } = await admin.rpc("merge_youtube_identity", { p_user_id: uSurvivor });
    if (mergeErr) fail(`merge rpc: ${mergeErr.message}`);
    if ((mergeRes as { merged?: boolean }).merged !== true) fail(`merge not applied: ${JSON.stringify(mergeRes)}`);
    ok(`merge applied: ${JSON.stringify(mergeRes)}`);

    // Assert: single pooled viewer_scores row, total_score = 10 + 5.
    const { data: vs } = await admin
      .from("viewer_scores")
      .select("participant_key, total_score, features_count")
      .eq("stream_id", streamId);
    assertEq(vs?.length, 1, "viewer_scores rows in stream");
    assertEq(vs?.[0].participant_key, uSurvivor, "pooled participant_key");
    assertEq(vs?.[0].total_score, 15, "pooled total_score");
    assertEq(vs?.[0].features_count, 1, "pooled features_count");

    // Assert: command participant key rewritten.
    const { data: ce } = await admin
      .from("command_events")
      .select("participant_key")
      .eq("stream_id", streamId);
    assertEq(ce?.[0].participant_key, uSurvivor, "command participant_key rewritten");

    // Assert: ban followed the person.
    const { data: bans } = await admin
      .from("banned_participants")
      .select("participant_key, user_id")
      .eq("channel_id", communityId);
    assertEq(bans?.length, 1, "ban rows for community");
    assertEq(bans?.[0].participant_key, uSurvivor, "ban participant_key rewritten");

    // Assert: membership credits summed, aggregates recomputed.
    const readMembership = async () => {
      const { data } = await admin
        .from("memberships")
        .select("credits, lifetime_xp, level, streams_attended, message_count")
        .eq("channel_id", survivorId)
        .eq("community_channel_id", communityId)
        .single();
      return data!;
    };
    let m = await readMembership();
    assertEq(m.credits, 50, "survivor credits summed");
    assertEq(m.lifetime_xp, 15, "survivor lifetime_xp");
    assertEq(m.streams_attended, 1, "survivor streams_attended");
    assertEq(m.message_count, 2, "survivor message_count pooled");

    // Assert: source membership deleted, source tombstoned.
    const { data: srcMem } = await admin
      .from("memberships")
      .select("channel_id")
      .eq("channel_id", sourceId);
    assertEq(srcMem?.length, 0, "source memberships deleted");
    const { data: srcCh } = await admin
      .from("channels")
      .select("youtube_channel_id, merged_into_channel_id")
      .eq("id", sourceId)
      .single();
    assertEq(srcCh!.youtube_channel_id, null, "source youtube_channel_id cleared");
    assertEq(srcCh!.merged_into_channel_id, survivorId, "source tombstoned to survivor");

    // Idempotency: a second merge must not double credits or scores.
    const { error: merge2Err } = await admin.rpc("merge_youtube_identity", { p_user_id: uSurvivor });
    if (merge2Err) fail(`second merge rpc: ${merge2Err.message}`);
    m = await readMembership();
    assertEq(m.credits, 50, "credits unchanged after second merge");
    const { data: vs2 } = await admin
      .from("viewer_scores")
      .select("total_score")
      .eq("stream_id", streamId);
    assertEq(vs2?.length, 1, "still one viewer_scores row after second merge");
    assertEq(vs2?.[0].total_score, 15, "total_score unchanged after second merge");

    // Contested identity: a claimed channel (different owner) already holds YCID2.
    await admin.from("channels").insert({
      owner_user_id: uOther,
      slug: `mtest_contested_${suffix}`,
      handle: `mtest_contested_${suffix}`.slice(0, 30),
      name: "Contested",
      youtube_channel_id: YCID2,
    });
    await admin.from("channels").insert({
      owner_user_id: uX,
      slug: `mtest_x_${suffix}`,
      handle: `mtest_x_${suffix}`.slice(0, 30),
      name: "Claimant X",
    });
    await admin.from("youtube_links").upsert(
      {
        user_id: uX,
        youtube_channel_id: YCID2,
        youtube_handle: `mtestx_${suffix}`,
        verify_code: "TESTBB",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    const { data: contestedRes, error: contestedErr } = await admin.rpc("merge_youtube_identity", { p_user_id: uX });
    if (contestedErr) fail(`contested merge rpc: ${contestedErr.message}`);
    assertEq((contestedRes as { merged?: boolean }).merged, false, "contested merge aborts");

    console.log("\nALL ASSERTIONS PASSED");
  } finally {
    for (const id of orphanChannels) {
      await admin.from("channels").delete().eq("id", id);
    }
    for (const uid of createdUsers) {
      await admin.auth.admin.deleteUser(uid);
    }
    ok("cleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
