import { cacheChannelAvatar } from "@/lib/channel-avatar";
import { ensureUniqueHandle, normalizeHandleBase } from "@/lib/channel-handle";
import { fetchChannelSnippets } from "@/lib/youtube";
import { supabaseAdmin } from "../supabase";

export type EnrichmentMode = "full" | "deferred";

type OnboardInput = {
  authorChannelId: string;
  authorName: string | null;
  avatarUrl: string | null;
  communityId: string;
  mode: EnrichmentMode;
};

async function takenHandles(): Promise<Set<string>> {
  const taken = new Set<string>();
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabaseAdmin
      .from("channels")
      .select("handle")
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) taken.add(c.handle.toLowerCase());
    if ((data ?? []).length < size) break;
  }
  return taken;
}

async function resolveExisting(authorChannelId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("id, merged_into_channel_id")
    .eq("youtube_channel_id", authorChannelId)
    .maybeSingle();
  if (error) {
    console.error("chatter channel lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  return data.merged_into_channel_id ?? data.id;
}

async function enrich(authorChannelId: string) {
  const snippets = await fetchChannelSnippets([authorChannelId]);
  const snippet = snippets.find((s) => s.channelId === authorChannelId);
  if (!snippet) return null;
  const remoteAvatarPath = await cacheChannelAvatar(authorChannelId, snippet.avatarUrl);
  return {
    base: snippet.customUrl || snippet.title,
    name: snippet.title,
    remoteAvatarPath,
  };
}

export async function ensureChatterChannel(
  input: OnboardInput
): Promise<string | null> {
  const existing = await resolveExisting(input.authorChannelId);
  if (existing) return existing;

  let base = input.authorName || "chatter";
  let name = input.authorName || "YouTube chatter";
  let remoteAvatarPath: string | null = null;
  let awaitingEnrichment = true;

  if (input.mode === "full") {
    try {
      const enriched = await enrich(input.authorChannelId);
      if (enriched) {
        base = enriched.base;
        name = enriched.name;
        remoteAvatarPath = enriched.remoteAvatarPath;
        awaitingEnrichment = false;
      }
    } catch (e) {
      console.error(
        `chatter enrichment failed for ${input.authorChannelId}, creating minimally:`,
        e
      );
    }
  }

  const taken = await takenHandles();
  const handle = ensureUniqueHandle(normalizeHandleBase(base), taken);

  const { data: inserted, error } = await supabaseAdmin
    .from("channels")
    .insert({
      owner_user_id: null,
      youtube_channel_id: input.authorChannelId,
      slug: handle,
      handle,
      name,
      remote_avatar_path: remoteAvatarPath,
      avatar_path: null,
      awaiting_enrichment: awaitingEnrichment,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return resolveExisting(input.authorChannelId);
    }
    console.error(`chatter channel insert failed for ${input.authorChannelId}:`, error?.message);
    return null;
  }

  const { error: recErr } = await supabaseAdmin.rpc("recompute_membership", {
    p_channel_id: inserted.id,
    p_community_channel_id: input.communityId,
  });
  if (recErr) {
    console.error(`membership recompute failed for @${handle}:`, recErr.message);
  }

  console.error(`[chat:new] @${handle} (${input.authorChannelId}) mode=${input.mode}`);
  return inserted.id;
}

export async function refreshMembership(
  channelId: string,
  communityId: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("recompute_membership", {
    p_channel_id: channelId,
    p_community_channel_id: communityId,
  });
  if (error) {
    console.error(`membership refresh failed for ${channelId}:`, error.message);
  }
}
