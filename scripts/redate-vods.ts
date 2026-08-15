// Dates every recording by when its broadcast started.
//
// A live recording was published at the moment processing finished, minutes
// after the broadcast ended, while an imported one has always been dated by its
// start. The studio lists a broadcast by `started_at`, so for a stream ending
// after local midnight the two pages disagreed about which day it belonged to:
// the 8-Aug-2026 broadcast reads 9 Aug on the channel and 8 Aug in the studio.
//
// Ordering is unaffected in practice, since broadcasts start in the same order
// they end.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

async function main() {
  const { data: videos, error } = await admin
    .from("videos")
    .select("id, source_stream_id, published_at, title")
    .not("source_stream_id", "is", null);
  if (error) throw new Error(error.message);

  const ids = (videos ?? []).map((v) => v.source_stream_id!).filter(Boolean);
  const starts = new Map<string, string | null>();
  const size = 200;
  for (let i = 0; i < ids.length; i += size) {
    const { data, error: sErr } = await admin
      .from("streams")
      .select("id, started_at, live_at")
      .in("id", ids.slice(i, i + size));
    if (sErr) throw new Error(sErr.message);
    for (const s of data ?? []) starts.set(s.id, s.started_at ?? s.live_at);
  }

  let changed = 0;
  let sameDay = 0;
  const moves: string[] = [];

  for (const v of videos ?? []) {
    const start = starts.get(v.source_stream_id!);
    if (!start || !v.published_at) continue;
    if (start === v.published_at) continue;
    changed += 1;
    const from = v.published_at.slice(0, 10);
    const to = start.slice(0, 10);
    if (from === to) sameDay += 1;
    else moves.push(`${from} -> ${to}  ${v.title?.slice(0, 50) ?? ""}`);
    if (APPLY) {
      const { error: uErr } = await admin
        .from("videos")
        .update({ published_at: start })
        .eq("id", v.id);
      if (uErr) throw new Error(`${v.id}: ${uErr.message}`);
    }
  }

  console.log(`recordings examined: ${videos?.length ?? 0}`);
  console.log(`timestamps to change: ${changed} (${sameDay} stay on the same UTC day)`);
  if (moves.length) {
    console.log(`\ncrossing a UTC day boundary: ${moves.length}`);
    for (const m of moves) console.log(`  ${m}`);
  }
  console.log(APPLY ? "\napplied" : "\ndry run — add --apply to write");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
