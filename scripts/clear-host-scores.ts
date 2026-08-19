import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

// Removes scoring data recorded against the host on their own broadcasts. The
// host is present in chat and absent from every score, so none of this should
// exist; it was written while chat read from Vids.Tube carried no host mark.
//
// Standings and member rank are both computed live from the rows below, so
// deleting them is the whole of the correction. Nothing caches a rank.
//
// The host's chat messages are left alone: the host did say them. Command events
// refused for want of credits are left alone too, as an accurate record.
//
// Dry run by default. Pass --apply to delete.
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

async function main() {
  const { data: channels } = await admin
    .from("channels")
    .select("id, owner_user_id")
    .not("owner_user_id", "is", null);

  const owners = new Map<string, string>();
  for (const c of channels ?? []) {
    if (c.owner_user_id) owners.set(c.id, c.owner_user_id);
  }

  const { data: streams } = await admin
    .from("streams")
    .select("id, channel_id, started_at, status");

  let scores = 0;
  let featured = 0;
  let events = 0;

  for (const s of streams ?? []) {
    const host = owners.get(s.channel_id);
    if (!host) continue;

    const { count: sc } = await admin
      .from("viewer_scores")
      .select("participant_key", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .eq("participant_key", host);
    const { count: fm } = await admin
      .from("featured_messages")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .eq("user_id", host);
    const { count: se } = await admin
      .from("score_events")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .eq("user_id", host);

    if (!sc && !fm && !se) continue;

    console.log(
      `${s.started_at?.slice(0, 10) ?? "?"} (${s.status}): ${sc ?? 0} score, ${fm ?? 0} featured, ${se ?? 0} event(s)`
    );
    scores += sc ?? 0;
    featured += fm ?? 0;
    events += se ?? 0;

    if (!APPLY) continue;

    for (const [table, col] of [
      ["viewer_scores", "participant_key"],
      ["featured_messages", "user_id"],
      ["score_events", "user_id"],
    ] as const) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("stream_id", s.id)
        .eq(col, host);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  console.log(
    `\n${APPLY ? "deleted" : "would delete"}: ${scores} score row(s), ${featured} featured, ${events} score event(s)`
  );
  if (!APPLY) console.log("dry run. pass --apply to delete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
