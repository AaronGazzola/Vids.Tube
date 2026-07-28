import { createClient } from "@supabase/supabase-js";
import { RESERVED_HANDLES } from "../lib/handle";
import { uploadToR2 } from "../lib/r2";
import { fetchChannelSnippets, upscaleGgphtAvatar } from "../lib/youtube";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizeBase(raw: string): string {
  let h = raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (h.length === 0) h = "user";
  if (h.length < 3) h = (h + "000").slice(0, 3);
  return h.slice(0, 30);
}

function ensureUniqueHandle(base: string, taken: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (
    candidate.length < 3 ||
    RESERVED_HANDLES.has(candidate) ||
    taken.has(candidate)
  ) {
    const suffix = `_${n}`;
    candidate = base.slice(0, 30 - suffix.length) + suffix;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

async function cacheAvatar(
  youtubeChannelId: string,
  avatarUrl: string | null
): Promise<string | null> {
  if (!avatarUrl) return null;
  try {
    const res = await fetch(upscaleGgphtAvatar(avatarUrl));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const key = `avatars/${youtubeChannelId}.jpg`;
    await uploadToR2(key, bytes, "image/jpeg");
    return key;
  } catch (e) {
    console.error(`avatar cache failed for ${youtubeChannelId}:`, e);
    return null;
  }
}

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

  const { data: chatters } = await admin
    .from("chatter_stats")
    .select("author_channel_id, author_name");
  const targets = (chatters ?? []).filter(
    (c) => !existingYt.has(c.author_channel_id)
  );
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
    const handle = ensureUniqueHandle(normalizeBase(baseSource), takenHandles);
    const name =
      snippet?.title || chatter.author_name || "YouTube chatter";

    const remoteAvatarPath = await cacheAvatar(
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
        remote_avatar_path: remoteAvatarPath,
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
      `created @${handle} (${chatter.author_channel_id}) avatar=${remoteAvatarPath ? "yes" : "no"}`
    );
  }

  console.log(`done: ${created} unclaimed channels created`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
