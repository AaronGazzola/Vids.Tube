"use server";

import type { ActionResult } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { fetchChannelByHandle } from "@/lib/youtube";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

async function getOwnedChannel(): Promise<
  ActionResult<{ id: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }
  const { data: channel, error } = await supabase
    .from("channels")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "No channel found for your account." };
  }
  return { data: channel };
}

export type BannedParticipant = {
  participantKey: string;
  origin: string;
  authorName: string | null;
  handle: string | null;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
};

export async function getBannedParticipantsAction(): Promise<
  BannedParticipant[]
> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("banned_participants")
    .select(
      "participant_key, origin, author_name, user_id, reason, banned_by, created_at"
    )
    .eq("channel_id", owned.data.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    throw new Error("Failed to load banned users");
  }

  const rows = data ?? [];
  const identities = await resolveAuthorIdentities(
    supabaseAdmin,
    rows.map((r) => r.user_id).filter((id): id is string => !!id)
  );

  return rows.map((r) => ({
    participantKey: r.participant_key,
    origin: r.origin,
    authorName: r.author_name,
    handle: r.user_id ? identities.get(r.user_id)?.handle ?? null : null,
    reason: r.reason,
    bannedBy: r.banned_by,
    createdAt: r.created_at,
  }));
}

export async function unbanParticipantAction(
  participantKey: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { error } = await supabaseAdmin
    .from("banned_participants")
    .delete()
    .eq("channel_id", owned.data.id)
    .eq("participant_key", participantKey);
  if (error) {
    console.error(error);
    throw new Error("Failed to unban");
  }
  return { data: { ok: true } };
}

export type YoutubeLink = {
  youtubeChannelId: string;
  youtubeHandle: string;
  verifyCode: string;
  verifiedAt: string | null;
};

async function requireUser(): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }
  return { data: { id: user.id } };
}

function newVerifyCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function toYoutubeLink(row: {
  youtube_channel_id: string;
  youtube_handle: string;
  verify_code: string;
  verified_at: string | null;
}): YoutubeLink {
  return {
    youtubeChannelId: row.youtube_channel_id,
    youtubeHandle: row.youtube_handle,
    verifyCode: row.verify_code,
    verifiedAt: row.verified_at,
  };
}

export async function getYoutubeLinkAction(): Promise<YoutubeLink | null> {
  const user = await requireUser();
  if ("error" in user) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("youtube_links")
    .select("youtube_channel_id, youtube_handle, verify_code, verified_at")
    .eq("user_id", user.data.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load YouTube link");
  }
  return data ? toYoutubeLink(data) : null;
}

export async function saveYoutubeLinkAction(
  handle: string
): Promise<ActionResult<YoutubeLink>> {
  const user = await requireUser();
  if ("error" in user) {
    return user;
  }
  const channel = await fetchChannelByHandle(handle);
  if (!channel) {
    return { error: "No YouTube channel found for that handle." };
  }
  const row = {
    user_id: user.data.id,
    youtube_channel_id: channel.channelId,
    youtube_handle: channel.handle,
    verify_code: newVerifyCode(),
    verified_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("youtube_links")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error(error);
    throw new Error("Failed to save YouTube link");
  }
  return { data: toYoutubeLink(row) };
}

export async function regenerateYoutubeCodeAction(): Promise<
  ActionResult<YoutubeLink>
> {
  const user = await requireUser();
  if ("error" in user) {
    return user;
  }
  const code = newVerifyCode();
  const { data, error } = await supabaseAdmin
    .from("youtube_links")
    .update({ verify_code: code, updated_at: new Date().toISOString() })
    .eq("user_id", user.data.id)
    .select("youtube_channel_id, youtube_handle, verify_code, verified_at")
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate the code");
  }
  if (!data) {
    return { error: "No YouTube link to refresh." };
  }
  return { data: toYoutubeLink(data) };
}

export async function unlinkYoutubeAction(): Promise<ActionResult<{ ok: true }>> {
  const user = await requireUser();
  if ("error" in user) {
    return user;
  }
  const { error } = await supabaseAdmin
    .from("youtube_links")
    .delete()
    .eq("user_id", user.data.id);
  if (error) {
    console.error(error);
    throw new Error("Failed to unlink");
  }
  return { data: { ok: true } };
}
