import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SNAPSHOT = argv.includes("--snapshot")
  ? argv[argv.indexOf("--snapshot") + 1]
  : ".snapshots/orphan-chat-rehome.json";

type Stream = { id: string; started_at: string; ended_at: string | null; title: string | null };

async function main() {
  const { data: streams, error: sErr } = await admin
    .from("streams")
    .select("id, started_at, ended_at, title, youtube_video_id");
  if (sErr) throw new Error(sErr.message);
  const { data: videos, error: vErr } = await admin
    .from("videos")
    .select("source_stream_id, duration_s");
  if (vErr) throw new Error(vErr.message);

  const durationByStream = new Map(
    (videos ?? []).map((v) => [v.source_stream_id as string, v.duration_s as number])
  );
  const hosts = (streams ?? []).filter((s) => durationByStream.has(s.id));
  const orphans = (streams ?? []).filter((s) => !durationByStream.has(s.id));

  const moves: { messageId: string; from: string; to: string; at: string; body: string }[] = [];
  const unplaced: { messageId: string; from: string; at: string; body: string }[] = [];

  for (const o of orphans as Stream[]) {
    const { data: msgs, error } = await admin
      .from("chat_messages")
      .select("id, created_at, body, origin")
      .eq("stream_id", o.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    for (const m of msgs ?? []) {
      const t = new Date(m.created_at).getTime();
      const containing = hosts.filter((h) => {
        const start = new Date(h.started_at).getTime();
        const end = start + (durationByStream.get(h.id) ?? 0) * 1000;
        return t >= start && t <= end;
      });
      if (containing.length === 1) {
        moves.push({
          messageId: m.id,
          from: o.id,
          to: containing[0].id,
          at: m.created_at,
          body: m.body.slice(0, 60),
        });
      } else {
        unplaced.push({ messageId: m.id, from: o.id, at: m.created_at, body: m.body.slice(0, 60) });
      }
    }
  }

  const fullyPlaced = orphans.filter((o) => !unplaced.some((u) => u.from === o.id));

  writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      { takenAt: new Date().toISOString(), orphans, moves, unplaced, deletable: fullyPlaced.map((o) => o.id) },
      null,
      2
    )
  );

  const byTarget = new Map<string, number>();
  for (const m of moves) byTarget.set(m.to, (byTarget.get(m.to) ?? 0) + 1);

  console.log(`broadcasts with no recording: ${orphans.length}`);
  for (const o of orphans as Stream[]) {
    const mine = moves.filter((m) => m.from === o.id).length;
    const stuck = unplaced.filter((u) => u.from === o.id).length;
    console.log(`  ${o.started_at.slice(0, 16)} "${(o.title ?? "").slice(0, 34)}" placed=${mine} unplaced=${stuck}`);
  }
  console.log(`\nmessages to move: ${moves.length}, unplaceable: ${unplaced.length}`);
  for (const [target, n] of byTarget) {
    const h = hosts.find((x) => x.id === target);
    console.log(`  ${n} -> ${h?.youtube_video_id} (${h?.started_at.slice(0, 10)})`);
  }
  for (const u of unplaced) console.log(`  UNPLACED ${u.at} ${u.body}`);
  console.log(`\nbroadcasts deletable after the move: ${fullyPlaced.length} of ${orphans.length}`);
  console.log(`snapshot written to ${SNAPSHOT}`);

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply.");
    return;
  }

  for (const m of moves) {
    const { error } = await admin
      .from("chat_messages")
      .update({ stream_id: m.to })
      .eq("id", m.messageId);
    if (error) throw new Error(`move failed for ${m.messageId}: ${error.message}`);
  }
  console.log(`moved ${moves.length} messages`);

  for (const o of fullyPlaced) {
    const { count } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", o.id);
    if ((count ?? 0) > 0) {
      throw new Error(`${o.id} still holds ${count} messages — refusing to delete`);
    }
    const { error } = await admin.from("streams").delete().eq("id", o.id);
    if (error) throw new Error(`delete failed for ${o.id}: ${error.message}`);
    console.log(`deleted empty broadcast ${o.id.slice(0, 8)}`);
  }

  const { data: after } = await admin.from("streams").select("id");
  const { data: afterVideos } = await admin.from("videos").select("source_stream_id");
  const stillOrphan = (after ?? []).filter(
    (s) => !(afterVideos ?? []).some((v) => v.source_stream_id === s.id)
  ).length;
  console.log(`\nbroadcasts with no recording remaining: ${stillOrphan}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
