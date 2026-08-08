import { cacheChannelAvatar, type CachedAvatar } from "@/lib/channel-avatar";
import { ensureUniqueHandle, normalizeHandleBase } from "@/lib/channel-handle";
import { fetchChannelSnippets, upscaleGgphtAvatar } from "@/lib/youtube";
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
  youtube_channel_id: string | null;
  avatar_source_url: string | null;
};

const RESOLVED_COLUMNS =
  "id, handle, is_software, awaiting_enrichment, youtube_channel_id, avatar_source_url";

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
    .select(`${RESOLVED_COLUMNS}, merged_into_channel_id`)
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
      .select(RESOLVED_COLUMNS)
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
    youtube_channel_id: data.youtube_channel_id,
    avatar_source_url: data.avatar_source_url,
  };
}

// Every chat message carries the author's current avatar URL, so a chatter who
// changed their picture is spotted for free, without spending YouTube quota.
// The URL only changes when the picture does, so an unchanged picture costs a
// string comparison and nothing else.
async function refreshAvatarIfChanged(
  channel: ResolvedChannel,
  input: OnboardInput
): Promise<void> {
  if (!input.avatarUrl) return;
  const sourceUrl = upscaleGgphtAvatar(input.avatarUrl);
  if (channel.avatar_source_url === sourceUrl) return;

  const cached = await cacheChannelAvatar(
    channel.youtube_channel_id ?? input.authorChannelId,
    sourceUrl
  );
  if (!cached) return;

  const { error } = await supabaseAdmin
    .from("channels")
    .update({
      remote_avatar_path: cached.path,
      avatar_source_url: cached.sourceUrl,
    })
    .eq("id", channel.id);
  if (error) {
    console.error(`avatar refresh failed for @${channel.handle}:`, error.message);
    return;
  }
  console.error(`[chat:avatar] refreshed @${channel.handle}`);
}

async function enrich(authorChannelId: string) {
  const snippets = await fetchChannelSnippets([authorChannelId]);
  const snippet = snippets.find((s) => s.channelId === authorChannelId);
  if (!snippet) return null;
  const cached = await cacheChannelAvatar(authorChannelId, snippet.avatarUrl);
  return {
    base: snippet.customUrl || snippet.title,
    name: snippet.title,
    cached,
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
      await refreshAvatarIfChanged(existing, input);
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
  let cachedAvatar: CachedAvatar | null = null;
  let awaitingEnrichment = true;

  if (input.mode === "full") {
    try {
      const enriched = await enrich(input.authorChannelId);
      if (enriched) {
        base = enriched.base;
        name = enriched.name;
        cachedAvatar = enriched.cached;
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
      remote_avatar_path: cachedAvatar?.path ?? null,
      avatar_source_url: cachedAvatar?.sourceUrl ?? null,
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
        await refreshAvatarIfChanged(raced, input);
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
