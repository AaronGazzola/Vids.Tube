import { createClient } from "@supabase/supabase-js";
import { cacheChannelAvatar } from "../lib/channel-avatar";
import { ensureUniqueHandle, normalizeHandleBase } from "../lib/channel-handle";
import { fetchChannelSnippets } from "../lib/youtube";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { error: memErr } = await admin.from("memberships").select("id").limit(1);
  const { error: chErr } = await admin
    .from("channels")
    .select("youtube_channel_id")
    .limit(1);
  if (memErr || chErr) {
    console.error(
      "AZ-169 schema not present (memberships / channels.youtube_channel_id). Apply channel-membership-model first."
    );
    process.exit(1);
  }

  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) {
    console.error("no owner community channel found");
    process.exit(1);
  }
  const community = owner.id;

  const { data: channels } = await admin
    .from("channels")
    .select("handle, youtube_channel_id");
  const takenHandles = new Set(
    (channels ?? []).map((c) => c.handle.toLowerCase())
  );
  const existingYt = new Set(
    (channels ?? [])
      .map((c) => c.youtube_channel_id)
      .filter((id): id is string => !!id)
  );

  // A community owner and a claimed chatter are not chatters to be created.
  // Creating one for the streamer's own account is exactly the fault that
  // produced the duplicate profile this job later had to merge away.
  const { data: ownedOrCommunity } = await admin
    .from("channels")
    .select("youtube_channel_id, owner_user_id")
    .not("youtube_channel_id", "is", null);
  const skipYt = new Map<string, string>();
  for (const c of ownedOrCommunity ?? []) {
    if (c.owner_user_id) skipYt.set(c.youtube_channel_id!, "claimed");
  }
  const { data: hostStreams } = await admin
    .from("streams")
    .select("youtube_channel_id")
    .not("youtube_channel_id", "is", null);
  for (const s of hostStreams ?? []) {
    skipYt.set(s.youtube_channel_id!, "host");
  }

  // Stored chat is the only source of who has spoken. The summary table it used
  // to read is a build artifact of the archive and is going away.
  const chatters: { author_channel_id: string; author_name: string | null }[] = [];
  {
    const seen = new Map<string, string | null>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("chat_messages")
        .select("external_author_id, author_name")
        .eq("origin", "youtube")
        .not("external_author_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const m of data ?? []) {
        if (!seen.has(m.external_author_id!)) seen.set(m.external_author_id!, m.author_name);
      }
      if ((data ?? []).length < PAGE) break;
    }
    for (const [id, name] of seen) {
      chatters.push({ author_channel_id: id, author_name: name });
    }
  }
  const targets = chatters.filter((c) => {
    if (existingYt.has(c.author_channel_id)) return false;
    const reason = skipYt.get(c.author_channel_id);
    if (reason) {
      console.log(`skip ${c.author_channel_id} (${reason})`);
      return false;
    }
    return true;
  });
  if (targets.length === 0) {
    console.log("no new chatters to create channels for");
    return;
  }

  const snippets = await fetchChannelSnippets(
    targets.map((c) => c.author_channel_id)
  );
  const snippetById = new Map(snippets.map((s) => [s.channelId, s]));

  let created = 0;
  for (const chatter of targets) {
    const snippet = snippetById.get(chatter.author_channel_id);
    const baseSource =
      snippet?.customUrl || snippet?.title || chatter.author_name || "chatter";
    const handle = ensureUniqueHandle(normalizeHandleBase(baseSource), takenHandles);
    const name =
      snippet?.title || chatter.author_name || "YouTube chatter";

    const cached = await cacheChannelAvatar(
      chatter.author_channel_id,
      snippet?.avatarUrl ?? null
    );

    const { data: inserted, error: insErr } = await admin
      .from("channels")
      .insert({
        owner_user_id: null,
        youtube_channel_id: chatter.author_channel_id,
        slug: handle,
        handle,
        name,
        remote_avatar_path: cached?.path ?? null,
        avatar_source_url: cached?.sourceUrl ?? null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error(
        `insert failed for ${chatter.author_channel_id} (@${handle}):`,
        insErr?.message
      );
      takenHandles.delete(handle);
      continue;
    }

    const { error: recErr } = await admin.rpc("recompute_membership", {
      p_channel_id: inserted.id,
      p_community_channel_id: community,
    });
    if (recErr) {
      console.error(`recompute failed for @${handle}:`, recErr.message);
    }
    created += 1;
    console.log(
      `created @${handle} (${chatter.author_channel_id}) avatar=${cached ? "yes" : "no"}`
    );
  }

  console.log(`done: ${created} unclaimed channels created`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
