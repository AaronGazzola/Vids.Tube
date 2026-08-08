import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const NIGHTBOT_YT = "UCSvjQBDgYDB5TGVmCZObcwA";
const PROBE_YT = "VERIFY_MEMBERSHIP_LOOP_PROBE";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function ownerCommunity() {
  const { data } = await admin
    .from("channels")
    .select("id, handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("no owner channel");
  return data;
}

async function memberCountExcludesNonPeople(communityId: string) {
  console.log("\nmember count excludes software and test accounts");

  const { data: count } = await admin.rpc("community_member_count", {
    p_community: communityId,
  });

  const { data: bot } = await admin
    .from("channels")
    .select("id, is_software")
    .eq("youtube_channel_id", NIGHTBOT_YT)
    .maybeSingle();
  check("the delivery bot is marked as software", bot?.is_software === true);

  const { data: tests } = await admin
    .from("channels")
    .select("id")
    .in("handle", ["test", "test4"]);
  check("both test channels are gone", (tests ?? []).length === 0);

  // Recompute the count by hand from raw rows: if the function and the hand
  // count disagree, the definition has drifted from what the pages show.
  const { data: rows } = await admin
    .from("memberships")
    .select("channel_id")
    .eq("community_channel_id", communityId);
  const ids = (rows ?? []).map((r) => r.channel_id);
  const { data: chans } = await admin
    .from("channels")
    .select("id, youtube_channel_id, is_software")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const byHand = (chans ?? []).filter(
    (c) => c.youtube_channel_id && !c.is_software
  ).length;
  check("the count matches a hand count of the same rule", count === byHand, `rpc=${count} hand=${byHand}`);

  const botCounted = (chans ?? []).some((c) => c.id === bot?.id && !c.is_software);
  check("the bot is not inside the counted set", !botCounted);

  // The host owns the community rather than belonging to it, so they must not
  // appear in their own count, leaderboard or chatter list. A check constraint
  // makes a self-membership impossible, which is what enforces it.
  check("the host holds no membership in their own community", !ids.includes(communityId));

  const { error: selfErr } = await admin
    .from("memberships")
    .insert({ channel_id: communityId, community_channel_id: communityId });
  check("a self-membership is rejected by the database", !!selfErr);

  return count ?? 0;
}

async function mergeLeavesCountUnchanged(communityId: string) {
  console.log("\nan identity claim does not move the total");

  // The one merge that has already happened is the evidence: the retired channel
  // holds no membership and no YouTube identity, and its survivor holds both.
  const { data: tombstones } = await admin
    .from("channels")
    .select("id, handle, youtube_channel_id, merged_into_channel_id")
    .not("merged_into_channel_id", "is", null);

  if (!tombstones?.length) {
    check("a completed merge is available to inspect", false, "no retired channels yet");
    return;
  }

  for (const t of tombstones) {
    check(
      `retired channel @${t.handle} gave up its YouTube identity`,
      t.youtube_channel_id === null
    );
    const { count: stillMember } = await admin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", t.id)
      .eq("community_channel_id", communityId);
    check(`retired channel @${t.handle} holds no membership`, (stillMember ?? 0) === 0);

    const { data: survivor } = await admin
      .from("channels")
      .select("id, handle, youtube_channel_id")
      .eq("id", t.merged_into_channel_id!)
      .maybeSingle();
    check(
      `survivor @${survivor?.handle} carries the YouTube identity, so it is still counted`,
      !!survivor?.youtube_channel_id
    );
  }
}

async function recomputeIsIdempotent(communityId: string) {
  console.log("\nrecomputing a membership twice changes nothing");

  const { data: sample } = await admin
    .from("memberships")
    .select("id, channel_id, lifetime_xp, level, message_count, streams_attended, current_streak, best_streak")
    .eq("community_channel_id", communityId)
    .order("message_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sample) {
    check("a membership is available to recompute", false);
    return;
  }

  const { error } = await admin.rpc("recompute_membership", {
    p_channel_id: sample.channel_id,
    p_community_channel_id: communityId,
  });
  if (error) {
    check("recompute runs without error", false, error.message);
    return;
  }

  const { data: after } = await admin
    .from("memberships")
    .select("lifetime_xp, level, message_count, streams_attended, current_streak, best_streak")
    .eq("id", sample.id)
    .maybeSingle();

  const same =
    after?.lifetime_xp === sample.lifetime_xp &&
    after?.level === sample.level &&
    after?.message_count === sample.message_count &&
    after?.streams_attended === sample.streams_attended &&
    after?.current_streak === sample.current_streak &&
    after?.best_streak === sample.best_streak;
  check("every total is identical after a second recompute", same);
}

async function greetingIsClaimedOnce(communityId: string) {
  console.log("\na chatter cannot be greeted twice in one broadcast");

  const { data: stream } = await admin
    .from("streams")
    .select("id")
    .eq("channel_id", communityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: member } = await admin
    .from("memberships")
    .select("channel_id")
    .eq("community_channel_id", communityId)
    .limit(1)
    .maybeSingle();
  if (!stream || !member) {
    check("a stream and a member are available", false);
    return;
  }

  await admin
    .from("stream_greetings")
    .delete()
    .eq("stream_id", stream.id)
    .eq("channel_id", member.channel_id);

  const first = await admin.from("stream_greetings").insert({
    stream_id: stream.id,
    channel_id: member.channel_id,
    kind: "new",
  });
  check("the first claim succeeds", !first.error, first.error?.message ?? "");

  const second = await admin.from("stream_greetings").insert({
    stream_id: stream.id,
    channel_id: member.channel_id,
    kind: "returning",
  });
  check("the second claim is rejected", second.error?.code === "23505", second.error?.code ?? "no error");

  await admin
    .from("stream_greetings")
    .delete()
    .eq("stream_id", stream.id)
    .eq("channel_id", member.channel_id);
  const { count: left } = await admin
    .from("stream_greetings")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", stream.id)
    .eq("channel_id", member.channel_id);
  check("the probe cleaned up after itself", (left ?? 0) === 0);
}

async function tombstoneChainIsRefused() {
  console.log("\na retired channel cannot be merged into another retired channel");

  const { data: tombstone } = await admin
    .from("channels")
    .select("id, handle")
    .not("merged_into_channel_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!tombstone) {
    check("a retired channel is available to aim at", false);
    return;
  }

  await admin.from("channels").delete().eq("youtube_channel_id", PROBE_YT);
  const { data: probe, error: makeErr } = await admin
    .from("channels")
    .insert({
      owner_user_id: null,
      youtube_channel_id: PROBE_YT,
      slug: "verify_probe_membership_loop",
      handle: "verify_probe_membership_loop",
      name: "verification probe",
    })
    .select("id")
    .single();
  if (makeErr || !probe) {
    check("a probe channel could be created", false, makeErr?.message ?? "");
    return;
  }

  const { error: chainErr } = await admin
    .from("channels")
    .update({ merged_into_channel_id: tombstone.id })
    .eq("id", probe.id);
  check("merging into a retired channel raises", !!chainErr, chainErr?.message.slice(0, 60) ?? "no error");

  const { data: after } = await admin
    .from("channels")
    .select("merged_into_channel_id")
    .eq("id", probe.id)
    .maybeSingle();
  check("the rejected merge changed nothing", after?.merged_into_channel_id === null);

  const { error: selfErr } = await admin
    .from("channels")
    .update({ merged_into_channel_id: probe.id })
    .eq("id", probe.id);
  check("merging a channel into itself raises", !!selfErr);

  await admin.from("channels").delete().eq("id", probe.id);
  const { count: leftOver } = await admin
    .from("channels")
    .select("*", { count: "exact", head: true })
    .eq("youtube_channel_id", PROBE_YT);
  check("the probe channel was removed", (leftOver ?? 0) === 0);
}

async function dayOneIsAwarded(communityId: string, memberCount: number) {
  console.log("\nDay One reached every real member");

  const { data: badge } = await admin
    .from("badges")
    .select("key, title, description")
    .eq("key", "day-one")
    .maybeSingle();
  check("the Day One badge is defined", !!badge);
  check("it carries a description a viewer can read", !!badge?.description);

  const { data: rows } = await admin
    .from("memberships")
    .select("id")
    .eq("community_channel_id", communityId);
  const ids = (rows ?? []).map((r) => r.id);
  const { count: awarded } = await admin
    .from("membership_badges")
    .select("*", { count: "exact", head: true })
    .eq("badge_key", "day-one")
    .in("membership_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  check(
    "every counted member holds Day One",
    awarded === memberCount,
    `awarded=${awarded} members=${memberCount}`
  );

  const { data: bot } = await admin
    .from("channels")
    .select("id")
    .eq("youtube_channel_id", NIGHTBOT_YT)
    .maybeSingle();
  if (bot) {
    const { data: botMembership } = await admin
      .from("memberships")
      .select("id")
      .eq("channel_id", bot.id)
      .eq("community_channel_id", communityId)
      .maybeSingle();
    if (botMembership) {
      const { count: botAwards } = await admin
        .from("membership_badges")
        .select("*", { count: "exact", head: true })
        .eq("membership_id", botMembership.id);
      check("the delivery bot was awarded nothing", (botAwards ?? 0) === 0);
    }
  }
}

async function main() {
  const owner = await ownerCommunity();
  console.log(`community: @${owner.handle}`);

  const memberCount = await memberCountExcludesNonPeople(owner.id);
  await mergeLeavesCountUnchanged(owner.id);
  await recomputeIsIdempotent(owner.id);
  await greetingIsClaimedOnce(owner.id);
  await tombstoneChainIsRefused();
  await dayOneIsAwarded(owner.id, memberCount);

  console.log(
    failures === 0
      ? `\nall checks passed — ${memberCount} members`
      : `\n${failures} check(s) failed`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
