"use server";

import type { ActionResult } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

type OwnedChannel = { id: string; slug: string };

async function getOwnedChannel(): Promise<ActionResult<OwnedChannel>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id, slug")
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

async function assertStreamOwned(
  streamId: string,
  channelId: string
): Promise<ActionResult<{ ok: true }>> {
  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id")
    .eq("id", streamId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.channel_id !== channelId) {
    return { error: "That broadcast is not on your channel." };
  }
  return { data: { ok: true } };
}

async function logAction(input: {
  streamId: string;
  targetKind: "message" | "participant";
  action: "hide" | "ban";
  chatMessageId?: string | null;
  participantKey?: string | null;
  origin?: string | null;
  userId?: string | null;
  externalAuthorId?: string | null;
  authorName?: string | null;
  reason?: string | null;
  status: "applied" | "dismissed";
}) {
  await supabaseAdmin.from("moderation_actions").insert({
    stream_id: input.streamId,
    target_kind: input.targetKind,
    action: input.action,
    chat_message_id: input.chatMessageId ?? null,
    participant_key: input.participantKey ?? null,
    origin: input.origin ?? null,
    user_id: input.userId ?? null,
    external_author_id: input.externalAuthorId ?? null,
    author_name: input.authorName ?? null,
    reason: input.reason ?? null,
    source: "owner",
    status: input.status,
    decided_at: new Date().toISOString(),
  });
}

export async function setModerationModeAction(
  streamId: string,
  mode: "manual" | "auto"
): Promise<ActionResult<{ mode: "manual" | "auto" }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };
  const ok = await assertStreamOwned(streamId, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const { error } = await supabaseAdmin
    .from("chat_scoring_state")
    .upsert(
      { stream_id: streamId, moderation_mode: mode, updated_at: new Date().toISOString() },
      { onConflict: "stream_id" }
    );
  if (error) {
    console.error(error);
    throw new Error("Failed to set moderation mode");
  }
  return { data: { mode } };
}

export async function hideMessageAction(
  streamId: string,
  chatMessageId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };
  const ok = await assertStreamOwned(streamId, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const { data: msg } = await supabaseAdmin
    .from("chat_messages")
    .select("id, user_id, stream_id")
    .eq("id", chatMessageId)
    .maybeSingle();
  if (!msg || msg.stream_id !== streamId) {
    return { error: "That message is not in this broadcast." };
  }

  const { error } = await supabaseAdmin
    .from("chat_messages")
    .update({ hidden_at: new Date().toISOString(), hidden_by: "owner" })
    .eq("id", chatMessageId);
  if (error) {
    console.error(error);
    throw new Error("Failed to hide message");
  }
  await supabaseAdmin
    .from("featured_messages")
    .delete()
    .eq("chat_message_id", chatMessageId);
  await logAction({
    streamId,
    targetKind: "message",
    action: "hide",
    chatMessageId,
    userId: msg.user_id,
    origin: "vidstube",
    status: "applied",
  });
  return { data: { ok: true } };
}

export async function unhideMessageAction(
  streamId: string,
  chatMessageId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };
  const ok = await assertStreamOwned(streamId, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const { error } = await supabaseAdmin
    .from("chat_messages")
    .update({ hidden_at: null, hidden_by: null })
    .eq("id", chatMessageId);
  if (error) {
    console.error(error);
    throw new Error("Failed to unhide message");
  }
  return { data: { ok: true } };
}

export async function banParticipantAction(input: {
  streamId: string;
  participantKey: string;
  origin: string;
  userId: string | null;
  externalAuthorId: string | null;
  authorName: string | null;
  reason?: string | null;
}): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };
  const ok = await assertStreamOwned(input.streamId, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const { error } = await supabaseAdmin.from("banned_participants").upsert(
    {
      channel_id: owned.data.id,
      participant_key: input.participantKey,
      origin: input.origin,
      user_id: input.userId,
      external_author_id: input.externalAuthorId,
      author_name: input.authorName,
      reason: input.reason ?? null,
      banned_by: "owner",
    },
    { onConflict: "channel_id,participant_key" }
  );
  if (error) {
    console.error(error);
    throw new Error("Failed to ban participant");
  }
  await logAction({
    streamId: input.streamId,
    targetKind: "participant",
    action: "ban",
    participantKey: input.participantKey,
    origin: input.origin,
    userId: input.userId,
    externalAuthorId: input.externalAuthorId,
    authorName: input.authorName,
    reason: input.reason ?? null,
    status: "applied",
  });
  return { data: { ok: true } };
}

export async function unbanParticipantAction(
  streamId: string,
  participantKey: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabaseAdmin
    .from("banned_participants")
    .delete()
    .eq("channel_id", owned.data.id)
    .eq("participant_key", participantKey);
  if (error) {
    console.error(error);
    throw new Error("Failed to unban participant");
  }
  return { data: { ok: true } };
}

export async function approveSuggestionAction(
  actionId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };

  const { data: row } = await supabaseAdmin
    .from("moderation_actions")
    .select("*")
    .eq("id", actionId)
    .maybeSingle();
  if (!row) return { error: "That suggestion no longer exists." };
  const ok = await assertStreamOwned(row.stream_id, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const nowIso = new Date().toISOString();
  if (row.action === "hide" && row.chat_message_id) {
    await supabaseAdmin
      .from("chat_messages")
      .update({ hidden_at: nowIso, hidden_by: "owner" })
      .eq("id", row.chat_message_id);
    await supabaseAdmin
      .from("featured_messages")
      .delete()
      .eq("chat_message_id", row.chat_message_id);
  }
  if (row.action === "ban" && row.participant_key) {
    await supabaseAdmin.from("banned_participants").upsert(
      {
        channel_id: owned.data.id,
        participant_key: row.participant_key,
        origin: row.origin ?? "vidstube",
        user_id: row.user_id,
        external_author_id: row.external_author_id,
        author_name: row.author_name,
        reason: row.reason,
        banned_by: "owner",
      },
      { onConflict: "channel_id,participant_key" }
    );
  }

  const { error } = await supabaseAdmin
    .from("moderation_actions")
    .update({ status: "applied", decided_at: nowIso })
    .eq("id", actionId);
  if (error) {
    console.error(error);
    throw new Error("Failed to approve suggestion");
  }
  return { data: { ok: true } };
}

export async function dismissSuggestionAction(
  actionId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabaseAdmin
    .from("moderation_actions")
    .update({ status: "dismissed", decided_at: new Date().toISOString() })
    .eq("id", actionId);
  if (error) {
    console.error(error);
    throw new Error("Failed to dismiss suggestion");
  }
  return { data: { ok: true } };
}

export type ModerationActionRow = {
  id: string;
  action: "hide" | "ban";
  target_kind: string;
  chat_message_id: string | null;
  participant_key: string | null;
  author_name: string | null;
  origin: string | null;
  reason: string | null;
  source: string;
  status: string;
  created_at: string;
  sender: string;
  body: string | null;
};

export type ModerationFeed = {
  mode: "manual" | "auto";
  actions: ModerationActionRow[];
};

export async function getModerationFeedAction(
  streamId: string
): Promise<ModerationFeed> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { mode: "manual", actions: [] };

  const { data: state } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("moderation_mode")
    .eq("stream_id", streamId)
    .maybeSingle();
  const mode = state?.moderation_mode === "auto" ? "auto" : "manual";

  const { data, error } = await supabaseAdmin
    .from("moderation_actions")
    .select(
      "id, action, target_kind, chat_message_id, participant_key, author_name, origin, reason, source, status, created_at, user_id"
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    throw new Error("Failed to load moderation feed");
  }

  const rows = data ?? [];
  const userIds = rows
    .map((r) => r.user_id)
    .filter((id): id is string => !!id);
  const idByUser = await resolveAuthorIdentities(supabaseAdmin, userIds);

  const msgIds = rows
    .map((r) => r.chat_message_id)
    .filter((id): id is string => !!id);
  const bodyByMsg = new Map<string, string>();
  if (msgIds.length) {
    const { data: msgs } = await supabaseAdmin
      .from("chat_messages")
      .select("id, body")
      .in("id", msgIds);
    for (const m of msgs ?? []) bodyByMsg.set(m.id, m.body);
  }

  const actions: ModerationActionRow[] = rows.map((r) => {
    const handle = r.user_id ? idByUser.get(r.user_id)?.handle : null;
    const sender = handle
      ? `@${handle}`
      : r.author_name ?? r.participant_key ?? "viewer";
    return {
      id: r.id,
      action: r.action as "hide" | "ban",
      target_kind: r.target_kind,
      chat_message_id: r.chat_message_id,
      participant_key: r.participant_key,
      author_name: r.author_name,
      origin: r.origin,
      reason: r.reason,
      source: r.source,
      status: r.status,
      created_at: r.created_at,
      sender,
      body: r.chat_message_id ? bodyByMsg.get(r.chat_message_id) ?? null : null,
    };
  });

  return { mode, actions };
}
