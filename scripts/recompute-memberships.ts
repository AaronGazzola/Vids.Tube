import { printStepResult } from "../lib/step-result";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");
// Scoped to one broadcast when asked: the post-broadcast pass only needs the
// memberships of the people who were in that broadcast, and rebuilding all 152
// channels once per broadcast would make a catch-up over the history quadratic.
const ONLY_STREAM = process.argv.includes("--stream")
  ? process.argv[process.argv.indexOf("--stream") + 1]
  : null;
const SNAPSHOT = process.argv.includes("--snapshot")
  ? process.argv[process.argv.indexOf("--snapshot") + 1]
  : "memberships-snapshot.json";

type Row = {
  channel_id: string;
  community_channel_id: string;
  message_count: number;
  streams_attended: number;
  lifetime_xp: number;
  level: number;
  credits: number;
  current_streak: number;
  best_streak: number;
};

async function readMemberships(community: string): Promise<Row[]> {
  const out: Row[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from("memberships")
      .select(
        "channel_id, community_channel_id, message_count, streams_attended, lifetime_xp, level, credits, current_streak, best_streak"
      )
      .eq("community_channel_id", community)
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < size) break;
  }
  return out;
}

async function main() {
  const { data: community, error: cErr } = await admin
    .from("channels")
    .select("id, slug")
    .not("owner_user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!community) throw new Error("no owned channel found — cannot resolve the community");

  const { data: channels, error: chErr } = await admin
    .from("channels")
    .select("id, slug, merged_into_channel_id, youtube_channel_id, owner_user_id")
    .order("created_at", { ascending: true });
  if (chErr) throw new Error(chErr.message);

  let targets = (channels ?? []).filter(
    (c) => c.id !== community.id && !c.merged_into_channel_id
  );

  if (ONLY_STREAM) {
    const { data: scored } = await admin
      .from("score_events")
      .select("external_author_id, user_id")
      .eq("stream_id", ONLY_STREAM);
    const accounts = new Set(
      (scored ?? []).map((r) => r.external_author_id).filter(Boolean)
    );
    const users = new Set((scored ?? []).map((r) => r.user_id).filter(Boolean));
    targets = targets.filter(
      (c) =>
        (c.youtube_channel_id && accounts.has(c.youtube_channel_id)) ||
        (c.owner_user_id && users.has(c.owner_user_id))
    );
    console.log(
      `scoped to one broadcast: ${targets.length} channel(s) took part`
    );
  }
  const before = await readMemberships(community.id);
  writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), community, before }, null, 2)
  );

  console.log(`community: @${community.slug}`);
  console.log(`channels considered: ${targets.length} of ${channels?.length ?? 0}`);
  console.log(`memberships before: ${before.length}`);
  console.log(`snapshot written to ${SNAPSHOT}`);

  if (!APPLY) {
    console.log("\ndry run — nothing changed. re-run with --apply to recompute.");
    return;
  }

  let ok = 0;
  const failed: string[] = [];
  for (const c of targets) {
    const { error } = await admin.rpc("recompute_membership", {
      p_channel_id: c.id,
      p_community_channel_id: community.id,
    });
    if (error) {
      failed.push(`@${c.slug}: ${error.message}`);
      continue;
    }
    ok += 1;
  }

  const after = await readMemberships(community.id);
  const byChannel = new Map(before.map((r) => [r.channel_id, r]));
  const created = after.filter((r) => !byChannel.has(r.channel_id));
  const changed = after.filter((r) => {
    const b = byChannel.get(r.channel_id);
    return (
      b &&
      (b.message_count !== r.message_count ||
        b.streams_attended !== r.streams_attended ||
        b.lifetime_xp !== r.lifetime_xp ||
        b.current_streak !== r.current_streak)
    );
  });

  console.log(`\nrecomputed ${ok} channels, ${failed.length} failed`);
  for (const f of failed) console.error(`  ${f}`);
  console.log(`memberships after: ${after.length} (${created.length} new)`);
  console.log(`memberships with changed totals: ${changed.length}`);
  for (const r of created) {
    console.log(
      `  new: ${r.channel_id.slice(0, 8)} messages=${r.message_count} broadcasts=${r.streams_attended} xp=${r.lifetime_xp}`
    );
  }
  const totalMessages = after.reduce((a, r) => a + r.message_count, 0);
  const totalAttended = after.reduce((a, r) => a + r.streams_attended, 0);
  console.log(`\ntotals: ${totalMessages} messages, ${totalAttended} broadcast attendances`);
  printStepResult({ rebuilt: ok, failed: failed.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
