import { printStepResult } from "../lib/step-result";
import { createClient } from "@supabase/supabase-js";
import {
  batchMessages,
  eligibleForScoring,
  transcriptWindow,
  type ScorableMessage,
  type TranscriptSegment,
} from "../lib/scoring-batches";
import { buildRubric, SCORING_CONFIG } from "../lib/scoring-config";
import { runClaude } from "../worker/lib/claude";
import { parseScoreResult, pointsFor } from "../worker/lib/scoring-prompt";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALL = argv.includes("--all");
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY_STREAM = flag("--stream");
const LIMIT = flag("--limit") ? Number(flag("--limit")) : Infinity;
// A long run over the whole history will be interrupted — a dropped network, a
// sleeping machine. Skipping broadcasts that already carry ratings for this
// configuration makes the run resumable without re-paying for what is done.
const SKIP_SCORED = argv.includes("--skip-scored");

type Broadcast = { id: string; started_at: string; title: string | null; channel_id: string };

async function pageAll<T>(
  table: "chat_messages" | "transcript_segments",
  cols: string,
  streamId: string
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .eq("stream_id", streamId)
      .order(table === "chat_messages" ? "created_at" : "start_s", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < size) break;
  }
  return out;
}

type BreakdownItem = {
  text: string;
  humour: number;
  insight: number;
  community: number;
  points: number;
};

function participantKey(m: ScorableMessage): string {
  return m.origin === "vidstube" ? String(m.userId) : `youtube:${m.externalAuthorId}`;
}

async function resolveHost(communityId: string): Promise<string | null> {
  const { data } = await admin
    .from("channels")
    .select("owner_user_id")
    .eq("id", communityId)
    .maybeSingle();
  return data?.owner_user_id ?? null;
}

async function alreadyScored(streamId: string): Promise<number> {
  const { count } = await admin
    .from("score_events")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", streamId)
    .eq("scoring_version", SCORING_CONFIG.version);
  return count ?? 0;
}

async function scoreBroadcast(b: Broadcast): Promise<{
  status: "scored" | "skipped" | "refused" | "done" | "partial" | "failed";
  messages: number;
  batches: number;
  participants: number;
  detail?: string;
}> {
  if (SKIP_SCORED && APPLY) {
    const existing = await alreadyScored(b.id);
    if (existing > 0) {
      return {
        status: "done",
        messages: 0,
        batches: 0,
        participants: 0,
        detail: `${existing} ratings already`,
      };
    }
  }
  const raw = await pageAll<{
    id: string;
    origin: string;
    user_id: string | null;
    external_author_id: string | null;
    author_name: string | null;
    body: string;
    created_at: string;
  }>("chat_messages", "id,origin,user_id,external_author_id,author_name,body,created_at", b.id);

  const messages: ScorableMessage[] = raw.map((m) => ({
    id: m.id,
    origin: m.origin,
    userId: m.user_id,
    externalAuthorId: m.external_author_id,
    authorName: m.author_name,
    body: m.body,
    createdAt: m.created_at,
  }));

  const host = await resolveHost(b.channel_id);
  const eligible = eligibleForScoring(messages, host);
  if (!eligible.length) {
    return { status: "skipped", messages: 0, batches: 0, participants: 0, detail: "no scorable chat" };
  }

  const segments = await pageAll<TranscriptSegment>(
    "transcript_segments",
    "start_s,end_s,text",
    b.id
  );
  if (!segments.length) {
    return {
      status: "refused",
      messages: eligible.length,
      batches: 0,
      participants: 0,
      detail: "no transcript",
    };
  }

  const batches = batchMessages(eligible);
  if (!APPLY) {
    const keys = new Set(eligible.map(participantKey));
    return {
      status: "scored",
      messages: eligible.length,
      batches: batches.length,
      participants: keys.size,
    };
  }

  await admin
    .from("score_events")
    .delete()
    .eq("stream_id", b.id)
    .eq("scoring_version", SCORING_CONFIG.version);

  const totals = new Map<string, { points: number; sample: ScorableMessage }>();
  let failedBatches = 0;

  for (const [i, batch] of batches.entries()) {
    const context = transcriptWindow(segments, batch, b.started_at);
    const lines = batch
      .map((m, j) => `[m${j}] (${m.origin}) ${m.authorName ?? "viewer"}: ${m.body}`)
      .join("\n");
    const prompt = `${buildRubric({ includeModeration: false })}

## Recent transcript
${context || "(no transcript for this stretch)"}

## New chat messages
${lines}

## Output
Return ONLY a JSON object, no prose, of this exact shape:
{
  "featured":   [],
  "scores":     [ { "ref": "<ref>", "humour": 0-100, "insight": 0-100, "community": 0-100 } ],
  "moderation": []
}
Use the exact id shown in [brackets] for each message as its "ref" (e.g. "m0", "m3"). Include every message in "scores".`;

    let parsed;
    try {
      parsed = parseScoreResult(await runClaude(prompt));
    } catch (e) {
      console.error(`  batch ${i + 1}/${batches.length} failed, retrying once: ${(e as Error).message}`);
      try {
        parsed = parseScoreResult(await runClaude(prompt));
      } catch (retryErr) {
        console.error(
          `  batch ${i + 1}/${batches.length} failed again: ${(retryErr as Error).message}`
        );
        failedBatches += 1;
        continue;
      }
    }

    const byRef = new Map<string, ScorableMessage>();
    batch.forEach((m, j) => byRef.set(`m${j}`, m));

    const perBatch = new Map<string, { points: number; sample: ScorableMessage; items: BreakdownItem[] }>();
    for (const s of parsed.scores) {
      const m = byRef.get(s.ref);
      if (!m) continue;
      const points = pointsFor(s, m.origin === "vidstube" ? "vidstube" : "youtube");
      const k = participantKey(m);
      const cur = perBatch.get(k) ?? { points: 0, sample: m, items: [] };
      cur.points += points;
      // The breakdown is kept so a changed point formula can be tried against
      // stored ratings rather than paying for the model again.
      cur.items.push({
        text: m.body.slice(0, 200),
        humour: s.humour,
        insight: s.insight,
        community: s.community,
        points,
      });
      perBatch.set(k, cur);
      const run = totals.get(k) ?? { points: 0, sample: m };
      run.points += points;
      totals.set(k, run);
    }

    for (const [, p] of perBatch) {
      if (!p.items.length) continue;
      const { error } = await admin.from("score_events").insert({
        stream_id: b.id,
        user_id: p.sample.userId,
        origin: p.sample.origin,
        external_author_id: p.sample.externalAuthorId,
        type: "score",
        points: p.points,
        scoring_version: SCORING_CONFIG.version,
        metadata: { backfill: true, items: p.items },
      });
      if (error) console.error(`  rating insert failed: ${error.message}`);
    }
    process.stdout.write(`\r  batch ${i + 1}/${batches.length}   `);
  }
  process.stdout.write("\n");

  for (const [key, p] of totals) {
    await admin
      .from("viewer_scores")
      .delete()
      .eq("stream_id", b.id)
      .eq("participant_key", key);
    const { error } = await admin.from("viewer_scores").insert({
      stream_id: b.id,
      user_id: p.sample.userId,
      origin: p.sample.origin,
      external_author_id: p.sample.externalAuthorId,
      author_name: p.sample.authorName,
      total_score: p.points,
      features_count: 0,
    });
    if (error) console.error(`  score row failed for ${key}: ${error.message}`);
  }

  const channelIds = new Set<string>();
  for (const [, p] of totals) {
    if (p.sample.externalAuthorId) {
      const { data } = await admin
        .from("channels")
        .select("id, merged_into_channel_id")
        .eq("youtube_channel_id", p.sample.externalAuthorId)
        .maybeSingle();
      const resolved = data?.merged_into_channel_id ?? data?.id;
      if (resolved) channelIds.add(resolved);
    } else if (p.sample.userId) {
      const { data } = await admin
        .from("channels")
        .select("id")
        .eq("owner_user_id", p.sample.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.id) channelIds.add(data.id);
    }
  }
  for (const channelId of channelIds) {
    if (channelId === b.channel_id) continue;
    const { error } = await admin.rpc("recompute_membership", {
      p_channel_id: channelId,
      p_community_channel_id: b.channel_id,
    });
    if (error) console.error(`  recompute failed for ${channelId}: ${error.message}`);
  }

  if (failedBatches === batches.length) {
    return {
      status: "failed",
      messages: eligible.length,
      batches: batches.length,
      participants: 0,
      detail: `all ${batches.length} batches failed`,
    };
  }
  return {
    status: failedBatches > 0 ? "partial" : "scored",
    messages: eligible.length,
    batches: batches.length,
    participants: totals.size,
    detail: failedBatches > 0 ? `${failedBatches} batch(es) failed` : undefined,
  };
}

async function main() {
  if (!ONLY_STREAM && !ALL) {
    throw new Error("pass --stream <id> for one broadcast, or --all for the history");
  }

  let q = admin.from("streams").select("id, started_at, title, channel_id");
  if (ONLY_STREAM) q = q.eq("id", ONLY_STREAM);
  const { data: broadcasts, error } = await q.order("started_at", { ascending: true });
  if (error) throw new Error(error.message);

  const targets = (broadcasts ?? []).slice(0, LIMIT === Infinity ? undefined : LIMIT);
  console.log(`scoring configuration: ${SCORING_CONFIG.version}`);
  console.log(`broadcasts to consider: ${targets.length}`);
  console.log(APPLY ? "" : "dry run — nothing will be written\n");

  const tally: Record<string, number> = {};
  let messages = 0;
  let batches = 0;

  for (const b of targets as Broadcast[]) {
    const label = `${b.started_at?.slice(0, 10)} ${(b.title ?? "").slice(0, 40)}`;
    const res = await scoreBroadcast(b);
    messages += res.messages;
    batches += res.batches;
    tally[res.status] = (tally[res.status] ?? 0) + 1;
    console.log(
      `${res.status.padEnd(8)} ${label} — ${res.messages} messages, ${res.batches} batches, ${res.participants} chatters${res.detail ? ` (${res.detail})` : ""}`
    );
  }

  console.log(
    `\n` +
      Object.entries(tally)
        .map(([k, n]) => `${k} ${n}`)
        .join(", ")
  );
  console.log(`messages ${messages}, model calls ${APPLY ? batches : 0} (${batches} batches)`);
  if (!APPLY) console.log("dry run — add --apply to write.");
  printStepResult({ scored: messages, failed: tally.failed ?? 0, batches });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
