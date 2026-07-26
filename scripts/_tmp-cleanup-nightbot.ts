import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const NIGHTBOT_CHANNEL_ID = "UCSvjQBDgYDB5TGVmCZObcwA";

async function main() {
  const { data: scores, error: e1 } = await admin
    .from("viewer_scores")
    .delete()
    .eq("participant_key", `youtube:${NIGHTBOT_CHANNEL_ID}`)
    .select("stream_id");
  if (e1) throw e1;
  console.log(`viewer_scores deleted: ${scores?.length ?? 0}`);

  const { data: events, error: e2 } = await admin
    .from("score_events")
    .delete()
    .eq("external_author_id", NIGHTBOT_CHANNEL_ID)
    .select("id");
  if (e2) throw e2;
  console.log(`score_events deleted: ${events?.length ?? 0}`);

  const { data: featured, error: e3 } = await admin
    .from("featured_messages")
    .delete()
    .eq("external_author_id", NIGHTBOT_CHANNEL_ID)
    .select("id");
  if (e3) throw e3;
  console.log(`featured_messages deleted: ${featured?.length ?? 0}`);

  const { data: msgs, error: e4 } = await admin
    .from("chat_messages")
    .delete()
    .eq("origin", "youtube")
    .eq("external_author_id", NIGHTBOT_CHANNEL_ID)
    .select("id");
  if (e4) throw e4;
  console.log(`chat_messages deleted: ${msgs?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
