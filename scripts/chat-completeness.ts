// How much of each broadcast's chat was actually captured.
//
// Three August broadcasts were recorded clean while holding roughly half their
// chat, and nothing in the system could tell. This is the measurement that makes
// that visible: what live capture stored, what the YouTube replay holds, and
// what is stored now that both have been accounted for.
//
// Computed from the chat and the archive on every run rather than read from a
// saved figure, so it cannot disagree with the data.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// The date the captured_via column landed. A broadcast repaired before this has
// its replay messages counted as live, which overstates live capture.
const CAPTURED_VIA_SINCE = "2026-08-15";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY_STREAM = flag("--stream");

// Counted head-only, so a broadcast with thousands of messages costs one small
// request rather than paging every row back just to measure it.
async function countRows(
  q: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

type Row = {
  date: string;
  videoId: string;
  live: number;
  stored: number;
  archived: number;
  overstated: boolean;
};

async function main() {
  let query = admin
    .from("streams")
    .select("id, started_at, youtube_video_id")
    .not("youtube_video_id", "is", null);
  if (ONLY_STREAM) query = query.eq("id", ONLY_STREAM);
  const { data: streams, error } = await query.order("started_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows: Row[] = [];
  const noArchive: Row[] = [];

  for (const s of streams ?? []) {
    const videoId = s.youtube_video_id!;

    const live = await countRows(
      admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", s.id)
        .eq("captured_via", "live")
        .in("origin", ["youtube", "bot"])
    );
    const stored = await countRows(
      admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", s.id)
        .in("origin", ["youtube", "bot"])
    );
    const archived = await countRows(
      admin
        .from("youtube_chat_archive")
        .select("message_id", { count: "exact", head: true })
        .eq("video_id", videoId)
    );

    const row: Row = {
      date: s.started_at?.slice(0, 10) ?? "undated",
      videoId,
      live,
      stored,
      archived,
      overstated: (s.started_at ?? "") < CAPTURED_VIA_SINCE,
    };
    // An archive that was never fetched is not evidence of a complete
    // broadcast, and folding it in as one is how 8-Aug-2026 passed with nothing
    // downloaded at all.
    if (archived === 0) noArchive.push(row);
    else rows.push(row);
  }

  console.log("date        video        live  archived  stored  shortfall");
  for (const r of rows) {
    const shortfall = Math.max(0, r.archived - r.live);
    const mark = shortfall > 0 ? "  <-- live capture fell short" : "";
    console.log(
      `${r.date}  ${r.videoId}  ${String(r.live).padStart(4)}  ${String(r.archived).padStart(8)}  ${String(
        r.stored
      ).padStart(6)}  ${String(shortfall).padStart(9)}${mark}`
    );
  }

  const short = rows.filter((r) => r.archived > r.live);
  console.log(
    `\n${rows.length} broadcast(s) compared, ${short.length} where live capture holds fewer messages than the replay`
  );

  if (noArchive.length) {
    console.log(`\n${noArchive.length} broadcast(s) have no chat replay to compare against:`);
    for (const r of noArchive) {
      console.log(`  ${r.date}  ${r.videoId}  ${r.live} stored live, replay not fetched`);
    }
    console.log("  Not complete — unmeasured. Run the chat log step for these.");
  }

  const overstated = [...rows, ...noArchive].filter((r) => r.overstated);
  if (overstated.length) {
    console.log(
      `\nNote: ${overstated.length} broadcast(s) started before ${CAPTURED_VIA_SINCE}, when messages began recording how they arrived. Any replay messages added to those by a repair are counted here as live, so their live figures are overstated.`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
