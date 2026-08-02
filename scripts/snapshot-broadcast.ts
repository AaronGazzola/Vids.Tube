import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STREAM_TABLES = [
  "ask_requests",
  "chat_messages",
  "chat_scoring_state",
  "clip_markers",
  "command_events",
  "featured_messages",
  "me_profiles",
  "membership_stream_stats",
  "moderation_actions",
  "score_events",
  "stream_chapters",
  "stream_gaps",
  "stream_goals",
  "stream_moments",
  "stream_sections",
  "transcript_segments",
  "tts_requests",
  "viewer_scores",
];

const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};

async function pageAll(table: string, streamIds: string[]) {
  const out: unknown[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .in("stream_id", streamIds)
      .range(from, from + size - 1);
    if (error) {
      return { error: error.message, rows: out };
    }
    out.push(...(data ?? []));
    if ((data ?? []).length < size) break;
  }
  return { rows: out };
}

async function main() {
  const idsArg = flag("--streams");
  if (!idsArg) throw new Error("pass --streams <comma-separated broadcast ids>");
  const streamIds = idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  const out = flag("--out") ?? "broadcast-snapshot.json";

  const { data: streams, error: sErr } = await admin
    .from("streams")
    .select("*")
    .in("id", streamIds);
  if (sErr) throw new Error(sErr.message);
  if (!streams || streams.length !== streamIds.length) {
    throw new Error(`expected ${streamIds.length} broadcasts, found ${streams?.length ?? 0}`);
  }

  const { data: videos, error: vErr } = await admin
    .from("videos")
    .select("*")
    .in("source_stream_id", streamIds);
  if (vErr) throw new Error(vErr.message);

  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const t of STREAM_TABLES) {
    const res = await pageAll(t, streamIds);
    if (res.error) {
      errors[t] = res.error;
      continue;
    }
    counts[t] = res.rows.length;
    if (res.rows.length) tables[t] = res.rows;
  }

  writeFileSync(
    out,
    JSON.stringify(
      { takenAt: new Date().toISOString(), streams, videos, counts, errors, tables },
      null,
      2
    )
  );

  console.log(`broadcasts: ${streams.length}`);
  for (const s of streams as { id: string; started_at: string; title: string; youtube_video_id: string | null }[]) {
    console.log(`  ${s.started_at?.slice(0, 10)} yt=${s.youtube_video_id ?? "none"} ${s.title?.slice(0, 45)}`);
  }
  console.log(`\nvideos: ${videos?.length ?? 0}`);
  for (const v of (videos ?? []) as { mp4_path: string | null; duration_s: number | null; status: string }[]) {
    console.log(`  ${v.status} ${v.duration_s}s ${v.mp4_path}`);
  }
  console.log("\nrows that would be removed with these broadcasts:");
  const ordered = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [t, n] of ordered) console.log(`  ${t.padEnd(26)} ${n}`);
  const total = ordered.reduce((a, [, n]) => a + n, 0);
  console.log(`  ${"TOTAL".padEnd(26)} ${total}`);
  for (const [t, e] of Object.entries(errors)) console.error(`  ${t}: unreadable (${e})`);
  console.log(`\nsnapshot written to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
