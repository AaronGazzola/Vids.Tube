// Recomputes points from ratings already stored, with no model calls. Only the
// arithmetic changes: the model's judgement of each message is kept exactly as
// it was. This is what makes the point curve cheap to tune.
import { createClient } from "@supabase/supabase-js";
import { pointsForMessage } from "../lib/scoring-points";
import { SCORING_CONFIG } from "../lib/scoring-config";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY_STREAM = flag("--stream");

type Item = { text: string; humour: number; insight: number; community: number; points: number };
type Rating = {
  id: string;
  stream_id: string;
  origin: string;
  user_id: string | null;
  external_author_id: string | null;
  points: number;
  metadata: unknown;
};

async function main() {
  let q = admin
    .from("score_events")
    .select("id,stream_id,origin,user_id,external_author_id,points,metadata")
    .eq("scoring_version", SCORING_CONFIG.version);
  if (ONLY_STREAM) q = q.eq("stream_id", ONLY_STREAM);
  const { data: ratings, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (ratings ?? []) as Rating[];
  const withBreakdown = rows.filter((r) => {
    const md = r.metadata as { items?: Item[] } | null;
    return Array.isArray(md?.items) && md.items.length > 0;
  });

  console.log(`scoring configuration: ${SCORING_CONFIG.version}`);
  console.log(
    `threshold ${SCORING_CONFIG.qualityThreshold}, exponent ${SCORING_CONFIG.curveExponent}, ceiling ${SCORING_CONFIG.maxPointsPerMessage}`
  );
  console.log(`ratings found: ${rows.length}, carrying a breakdown: ${withBreakdown.length}`);
  if (rows.length !== withBreakdown.length) {
    console.log(
      `${rows.length - withBreakdown.length} ratings have no breakdown and cannot be re-derived; re-score those broadcasts instead`
    );
  }
  if (!withBreakdown.length) return;

  const perStream = new Map<string, Map<string, { points: number; sample: Rating }>>();
  let oldTotal = 0;
  let newTotal = 0;
  const updates: { id: string; points: number; items: Item[] }[] = [];

  for (const r of withBreakdown) {
    const md = r.metadata as { items: Item[] };
    const items = md.items.map((it) => ({
      ...it,
      points: pointsForMessage(it, r.origin),
    }));
    const points = items.reduce((a, it) => a + it.points, 0);
    oldTotal += r.points;
    newTotal += points;
    updates.push({ id: r.id, points, items });

    const key = r.external_author_id ? `youtube:${r.external_author_id}` : String(r.user_id);
    if (!perStream.has(r.stream_id)) perStream.set(r.stream_id, new Map());
    const byKey = perStream.get(r.stream_id)!;
    const cur = byKey.get(key) ?? { points: 0, sample: r };
    cur.points += points;
    byKey.set(key, cur);
  }

  console.log(`\npoints before: ${oldTotal}, after: ${newTotal}`);
  console.log(`broadcasts affected: ${perStream.size}`);

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply to write.");
    return;
  }

  for (const u of updates) {
    const { error: upErr } = await admin
      .from("score_events")
      .update({ points: u.points, metadata: { backfill: true, items: u.items } })
      .eq("id", u.id);
    if (upErr) console.error(`rating update failed: ${upErr.message}`);
  }
  console.log(`updated ${updates.length} ratings`);

  let scoreRows = 0;
  const channelsByStream = new Map<string, Set<string>>();
  for (const [streamId, byKey] of perStream) {
    const { data: stream } = await admin
      .from("streams")
      .select("channel_id")
      .eq("id", streamId)
      .maybeSingle();
    if (!stream) continue;
    for (const [key, p] of byKey) {
      const { error: vsErr } = await admin
        .from("viewer_scores")
        .update({ total_score: p.points })
        .eq("stream_id", streamId)
        .eq("participant_key", key);
      if (vsErr) console.error(`score row update failed: ${vsErr.message}`);
      else scoreRows += 1;

      let channelId: string | null = null;
      if (p.sample.external_author_id) {
        const { data } = await admin
          .from("channels")
          .select("id, merged_into_channel_id")
          .eq("youtube_channel_id", p.sample.external_author_id)
          .maybeSingle();
        channelId = data?.merged_into_channel_id ?? data?.id ?? null;
      } else if (p.sample.user_id) {
        const { data } = await admin
          .from("channels")
          .select("id")
          .eq("owner_user_id", p.sample.user_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        channelId = data?.id ?? null;
      }
      if (channelId && channelId !== stream.channel_id) {
        if (!channelsByStream.has(stream.channel_id)) {
          channelsByStream.set(stream.channel_id, new Set());
        }
        channelsByStream.get(stream.channel_id)!.add(channelId);
      }
    }
  }
  console.log(`updated ${scoreRows} per-broadcast score rows`);

  let recomputed = 0;
  for (const [communityId, channelIds] of channelsByStream) {
    for (const channelId of channelIds) {
      const { error: recErr } = await admin.rpc("recompute_membership", {
        p_channel_id: channelId,
        p_community_channel_id: communityId,
      });
      if (recErr) console.error(`recompute failed for ${channelId}: ${recErr.message}`);
      else recomputed += 1;
    }
  }
  console.log(`recomputed ${recomputed} memberships`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
