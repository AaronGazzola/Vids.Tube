import { createClient } from "@supabase/supabase-js";
import { selectMissing, type CandidateMessage, type StoredMessage } from "../lib/chat-dedup";
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
const BATCH = 500;

async function storedFor(streamId: string): Promise<StoredMessage[]> {
  const out: StoredMessage[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from("chat_messages")
      .select("external_message_id, external_author_id, body, created_at")
      .eq("stream_id", streamId)
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(
      ...(data ?? []).map((m) => ({
        externalMessageId: m.external_message_id,
        externalAuthorId: m.external_author_id,
        body: m.body,
        createdAt: m.created_at,
      }))
    );
    if ((data ?? []).length < size) break;
  }
  return out;
}

async function archivedFor(videoId: string): Promise<CandidateMessage[]> {
  const out: CandidateMessage[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from("youtube_chat_archive")
      .select("message_id, author_channel_id, author_name, body, published_at")
      .eq("video_id", videoId)
      .order("published_at", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(
      ...(data ?? []).map((m) => ({
        messageId: m.message_id,
        authorChannelId: m.author_channel_id,
        body: m.body,
        publishedAt: m.published_at,
        authorName: m.author_name,
      })) as CandidateMessage[]
    );
    if ((data ?? []).length < size) break;
  }
  return out;
}

async function main() {
  let query = admin
    .from("streams")
    .select("id, started_at, youtube_video_id, title")
    .not("youtube_video_id", "is", null);
  if (ONLY_STREAM) query = query.eq("id", ONLY_STREAM);
  const { data: streams, error } = await query.order("started_at", { ascending: true });
  if (error) throw new Error(error.message);

  let totalMissing = 0;
  let totalInserted = 0;
  const gaps: string[] = [];

  for (const s of streams ?? []) {
    const archived = await archivedFor(s.youtube_video_id!);
    if (!archived.length) continue;
    const stored = await storedFor(s.id);
    const { missing, matchedById, matchedByBody } = selectMissing(archived, stored);
    if (!missing.length) continue;

    totalMissing += missing.length;
    gaps.push(
      `${s.started_at?.slice(0, 10)} ${s.youtube_video_id}: ${missing.length} missing of ${archived.length} archived (matched ${matchedById} by id, ${matchedByBody} by text)`
    );

    if (!APPLY) continue;

    const rows = missing.map((m) => ({
      stream_id: s.id,
      user_id: null,
      origin: "youtube",
      external_author_id: m.authorChannelId,
      author_name: (m as CandidateMessage & { authorName?: string | null }).authorName ?? null,
      external_message_id: m.messageId,
      body: m.body,
      created_at: m.publishedAt,
      captured_via: "replay",
    }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: insErr } = await admin.from("chat_messages").insert(rows.slice(i, i + BATCH));
      if (insErr) throw new Error(`${s.youtube_video_id}: ${insErr.message}`);
      totalInserted += Math.min(BATCH, rows.length - i);
    }
  }

  console.log(`broadcasts checked: ${streams?.length ?? 0}`);
  if (!gaps.length) {
    console.log("no gaps found — every archived message is already stored");
    return;
  }
  console.log(`broadcasts with a gap: ${gaps.length}`);
  for (const g of gaps) console.log(`  ${g}`);
  console.log(`\ntotal missing: ${totalMissing}`);
  if (!APPLY) {
    console.log("dry run — nothing changed. add --apply to fill the gaps.");
    return;
  }
  console.log(`inserted: ${totalInserted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
