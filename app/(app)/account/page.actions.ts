"use server";

import type { ActionResult } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
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
