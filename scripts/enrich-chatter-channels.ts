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

const APPLY = process.argv.includes("--apply");

async function main() {
  const { data: pending, error } = await admin
    .from("channels")
    .select("id, handle, name, youtube_channel_id")
    .eq("awaiting_enrichment", true);
  if (error) throw new Error(error.message);

  const targets = (pending ?? []).filter((c) => c.youtube_channel_id);
  console.log(`channels awaiting enrichment: ${pending?.length ?? 0}`);
  console.log(`with a YouTube account to look up: ${targets.length}`);
  if (!targets.length) {
    console.log("nothing to do");
    return;
  }

  const { data: allChannels } = await admin.from("channels").select("handle");
  const taken = new Set((allChannels ?? []).map((c) => c.handle.toLowerCase()));
  for (const t of targets) taken.delete(t.handle.toLowerCase());

  const snippets = await fetchChannelSnippets(
    targets.map((c) => c.youtube_channel_id!)
  );
  const byId = new Map(snippets.map((s) => [s.channelId, s]));

  let enriched = 0;
  let leftForLater = 0;

  for (const c of targets) {
    const snippet = byId.get(c.youtube_channel_id!);
    if (!snippet) {
      leftForLater += 1;
      console.log(`  ${c.handle}: no snippet returned, leaving for a later run`);
      continue;
    }
    const base = normalizeHandleBase(snippet.customUrl || snippet.title || c.name);
    const handle = ensureUniqueHandle(base, taken);
    console.log(`  ${c.handle} -> @${handle} (${snippet.title})`);
    if (!APPLY) continue;

    const remoteAvatarPath = await cacheChannelAvatar(
      c.youtube_channel_id!,
      snippet.avatarUrl
    );
    const { error: updErr } = await admin
      .from("channels")
      .update({
        handle,
        slug: handle,
        name: snippet.title || c.name,
        remote_avatar_path: remoteAvatarPath,
        awaiting_enrichment: false,
      })
      .eq("id", c.id);
    if (updErr) {
      console.error(`  update failed for ${c.handle}: ${updErr.message}`);
      leftForLater += 1;
      continue;
    }
    enriched += 1;
  }

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply to write.");
    return;
  }
  console.log(`\nenriched ${enriched}, left for a later run ${leftForLater}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
