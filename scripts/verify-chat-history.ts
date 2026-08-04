// Asserts that stored chat is the only source of chat history, and that linking
// an identity cannot change a chatter's totals. The second assertion is the
// whole point of the change: the old path counted a linked chatter's messages
// once from the archive summary and again from their user id.
import { createClient } from "@supabase/supabase-js";
import { summariseChat, type ChatRow } from "../lib/chatter-stats";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const failures: string[] = [];
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function page<T>(table: "chat_messages" | "youtube_chat_archive" | "channels" | "memberships", cols: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < size) break;
  }
  return out;
}

async function main() {
  const msgs = await page<{
    stream_id: string;
    created_at: string;
    user_id: string | null;
    external_author_id: string | null;
    origin: string;
  }>("chat_messages", "stream_id,created_at,user_id,external_author_id,origin");
  const archive = await page<{ author_channel_id: string }>(
    "youtube_chat_archive",
    "author_channel_id"
  );
  const channels = await page<{
    id: string;
    handle: string;
    youtube_channel_id: string | null;
    owner_user_id: string | null;
    merged_into_channel_id: string | null;
  }>("channels", "id,handle,youtube_channel_id,owner_user_id,merged_into_channel_id");
  const memberships = await page<{ channel_id: string }>("memberships", "channel_id");

  const rows: ChatRow[] = msgs.map((m) => ({
    streamId: m.stream_id,
    createdAt: m.created_at,
    userId: m.user_id,
    externalAuthorId: m.external_author_id,
  }));

  const storedAuthors = new Set(
    msgs.filter((m) => m.origin === "youtube").map((m) => m.external_author_id).filter(Boolean)
  );
  const archiveAuthors = new Set(archive.map((a) => a.author_channel_id));
  const missing = [...archiveAuthors].filter((a) => !storedAuthors.has(a));
  check(
    missing.length === 0,
    "every author in the archive has stored chat",
    `${missing.length} missing`
  );

  const memberChannels = new Set(memberships.map((m) => m.channel_id));
  const community = channels
    .filter((c) => c.owner_user_id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const hostAccounts = new Set(community.map((c) => c.youtube_channel_id).filter(Boolean));
  const noMembership = channels.filter(
    (c) =>
      c.youtube_channel_id &&
      !c.merged_into_channel_id &&
      storedAuthors.has(c.youtube_channel_id) &&
      !memberChannels.has(c.id) &&
      !hostAccounts.has(c.youtube_channel_id)
  );
  check(
    noMembership.length === 0,
    "every chatter with stored chat holds a membership",
    noMembership.map((c) => `@${c.handle}`).join(", ") || "none, host aside"
  );

  // A linked identity legitimately has more messages than its YouTube account
  // alone, because it also has site-typed messages that carry only a user id.
  // What must never happen is a message being counted twice — which is what the
  // old two-branch count did the moment the merge attached a user id to rows the
  // archive summary had already counted.
  const linked = channels.filter((c) => c.owner_user_id && c.youtube_channel_id);
  let noDoubleCount = true;
  const detail: string[] = [];
  for (const c of linked) {
    const total = summariseChat(rows, {
      userId: c.owner_user_id,
      youtubeChannelId: c.youtube_channel_id,
    }).totalMessages;
    const byAccount = rows.filter((r) => r.externalAuthorId === c.youtube_channel_id).length;
    const byUser = rows.filter((r) => r.userId === c.owner_user_id).length;
    const distinct = rows.filter(
      (r) => r.externalAuthorId === c.youtube_channel_id || r.userId === c.owner_user_id
    ).length;
    if (total !== distinct) noDoubleCount = false;
    detail.push(
      `@${c.handle}: ${total} counted, ${byAccount} by account + ${byUser} by user would have been ${byAccount + byUser}`
    );
  }
  check(
    noDoubleCount,
    "no message is counted twice for a linked identity",
    detail.join("; ") || "no linked identity to check"
  );

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
