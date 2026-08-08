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

// The greeting needs the handle to build a personal link, whether the chatter is
// new, and whether their handle is still a guess — all known here, so returning
// them avoids the greeting step re-reading the row it just wrote.
export type OnboardResult = {
  channelId: string;
  isNew: boolean;
  handle: string;
  isSoftware: boolean;
  awaitingEnrichment: boolean;
};

type ResolvedChannel = {
  id: string;
  handle: string;
  is_software: boolean;
  awaiting_enrichment: boolean;
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

async function resolveExisting(
  authorChannelId: string
): Promise<ResolvedChannel | null> {
  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("id, handle, is_software, awaiting_enrichment, merged_into_channel_id")
    .eq("youtube_channel_id", authorChannelId)
    .maybeSingle();
  if (error) {
    console.error("chatter channel lookup failed:", error.message);
    return null;
  }
  if (!data) return null;

  // One hop is always enough: a trigger forbids a channel being merged into a
  // channel that is itself merged, so a tombstone can never point at a tombstone.
  if (data.merged_into_channel_id) {
    const { data: survivor, error: survErr } = await supabaseAdmin
      .from("channels")
      .select("id, handle, is_software, awaiting_enrichment")
      .eq("id", data.merged_into_channel_id)
      .maybeSingle();
    if (survErr) {
      console.error("merged channel lookup failed:", survErr.message);
      return null;
    }
    return survivor ?? null;
  }

  return {
    id: data.id,
    handle: data.handle,
    is_software: data.is_software,
    awaiting_enrichment: data.awaiting_enrichment,
  };
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
): Promise<OnboardResult | null> {
  const existing = await resolveExisting(input.authorChannelId);
  if (existing) {
    // The membership is computed here, not only when the channel is created.
    // A chatter who already has a channel from another community holds no
    // membership in this one until something computes it, and the scoring step
    // that used to do it runs later and only when the AI call succeeds.
    if (!existing.is_software) {
      await refreshMembership(existing.id, input.communityId);
    }
    return {
      channelId: existing.id,
      isNew: false,
      handle: existing.handle,
      isSoftware: existing.is_software,
      awaitingEnrichment: existing.awaiting_enrichment,
    };
  }

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
      const raced = await resolveExisting(input.authorChannelId);
      if (!raced) return null;
      if (!raced.is_software) {
        await refreshMembership(raced.id, input.communityId);
      }
      return {
        channelId: raced.id,
        isNew: false,
        handle: raced.handle,
        isSoftware: raced.is_software,
        awaitingEnrichment: raced.awaiting_enrichment,
      };
    }
    console.error(`chatter channel insert failed for ${input.authorChannelId}:`, error?.message);
    return null;
  }

  await refreshMembership(inserted.id, input.communityId);

  console.error(`[chat:new] @${handle} (${input.authorChannelId}) mode=${input.mode}`);
  return {
    channelId: inserted.id,
    isNew: true,
    handle,
    isSoftware: false,
    awaitingEnrichment,
  };
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
