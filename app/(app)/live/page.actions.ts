"use server";

import type { ActionResult, ChatMessage } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

// Owner chat feed for the /live Activity tab: unlike the public chat query, this
// includes hidden messages so the owner can reveal / unhide them.
export async function getOwnerChatMessagesAction(
  streamId: string
): Promise<ChatMessage[]> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return [];
  }
  const ok = await assertStreamOwned(streamId, owned.data.id);
  if ("error" in ok) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error(error);
    throw new Error("Failed to load chat");
  }

  const authorByUser = await resolveAuthorIdentities(
    supabaseAdmin,
    (data ?? []).map((m) => m.user_id).filter((id): id is string => !!id)
  );

  return (data ?? []).map((m) => ({
    ...m,
    author: m.user_id ? authorByUser.get(m.user_id) ?? null : null,
  }));
}

// Highlight any chat message on the overlay, even one the bot never featured. If a
// featured row already exists it is (re)promoted; otherwise a manual one is created.
export async function manualHighlightAction(
  chatMessageId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };

  const { data: msg } = await supabaseAdmin
    .from("chat_messages")
    .select(
      "id, stream_id, user_id, origin, external_author_id, author_name, author_avatar_url, body"
    )
    .eq("id", chatMessageId)
    .maybeSingle();
  if (!msg) return { error: "That message no longer exists." };
  const ok = await assertStreamOwned(msg.stream_id, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("featured_messages")
    .select("id")
    .eq("chat_message_id", chatMessageId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("featured_messages")
      .update({ promoted_at: nowIso })
      .eq("id", existing.id);
    if (error) {
      console.error(error);
      throw new Error("Failed to highlight message");
    }
  } else {
    const { error } = await supabaseAdmin.from("featured_messages").insert({
      stream_id: msg.stream_id,
      chat_message_id: msg.id,
      user_id: msg.user_id,
      origin: msg.origin,
      external_author_id: msg.external_author_id,
      author_name: msg.author_name,
      author_avatar_url: msg.author_avatar_url,
      body: msg.body,
      score: 0,
      reason: null,
      ring_level: 1,
      promoted_at: nowIso,
    });
    if (error) {
      console.error(error);
      throw new Error("Failed to highlight message");
    }
  }
  return { data: { ok: true } };
}

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

export async function promoteHighlightAction(
  featuredMessageId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) return { error: owned.error };

  const { data: fm } = await supabaseAdmin
    .from("featured_messages")
    .select("id, stream_id")
    .eq("id", featuredMessageId)
    .maybeSingle();
  if (!fm) return { error: "That message no longer exists." };
  const ok = await assertStreamOwned(fm.stream_id, owned.data.id);
  if ("error" in ok) return { error: ok.error };

  const { error } = await supabaseAdmin
    .from("featured_messages")
    .update({ promoted_at: new Date().toISOString() })
    .eq("id", featuredMessageId);
  if (error) {
    console.error(error);
    throw new Error("Failed to show highlight on overlay");
  }
  return { data: { ok: true } };
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
  hidePastMessages?: boolean;
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

  // Optionally hide all of this participant's past messages in the stream (and
  // drop any features of theirs).
  if (input.hidePastMessages && (input.userId || input.externalAuthorId)) {
    const nowIso = new Date().toISOString();
    let hideQuery = supabaseAdmin
      .from("chat_messages")
      .update({ hidden_at: nowIso, hidden_by: "owner" })
      .eq("stream_id", input.streamId)
      .is("hidden_at", null);
    let featuredQuery = supabaseAdmin
      .from("featured_messages")
      .delete()
      .eq("stream_id", input.streamId);
    if (input.userId) {
      hideQuery = hideQuery.eq("user_id", input.userId);
      featuredQuery = featuredQuery.eq("user_id", input.userId);
    } else if (input.externalAuthorId) {
      hideQuery = hideQuery
        .eq("origin", "youtube")
        .eq("external_author_id", input.externalAuthorId);
      featuredQuery = featuredQuery
        .eq("origin", "youtube")
        .eq("external_author_id", input.externalAuthorId);
    }
    const { error: hideError } = await hideQuery;
    if (hideError) {
      console.error(hideError);
      throw new Error("Failed to hide the participant's past messages");
    }
    await featuredQuery;
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

export type ReasoningItem = {
  text: string;
  engagement: number;
  humour: number;
  contribution: number;
  points: number;
  createdAt: string;
};

export type ViewerReasoning = {
  items: ReasoningItem[];
  featureReasons: string[];
  totalPoints: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getViewerReasoningAction(input: {
  streamId: string;
  userId: string | null;
  origin: string;
  externalAuthorId: string | null;
}): Promise<ViewerReasoning> {
  const empty: ViewerReasoning = { items: [], featureReasons: [], totalPoints: 0 };
  const owned = await getOwnedChannel();
  if ("error" in owned) return empty;
  const ok = await assertStreamOwned(input.streamId, owned.data.id);
  if ("error" in ok) return empty;

  let query = supabaseAdmin
    .from("score_events")
    .select("metadata, points, created_at")
    .eq("stream_id", input.streamId)
    .eq("type", "score");

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  } else if (input.externalAuthorId) {
    query = query
      .eq("origin", input.origin)
      .eq("external_author_id", input.externalAuthorId);
  } else {
    return empty;
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    throw new Error("Failed to load scoring reasoning");
  }

  const items: ReasoningItem[] = [];
  const featureReasons: string[] = [];
  let totalPoints = 0;

  for (const row of data ?? []) {
    totalPoints += num(row.points);
    const meta = (row.metadata ?? {}) as {
      items?: unknown[];
      reasons?: unknown[];
    };
    for (const raw of Array.isArray(meta.items) ? meta.items : []) {
      const it = raw as Record<string, unknown>;
      items.push({
        text: typeof it.text === "string" ? it.text : "",
        engagement: num(it.engagement),
        humour: num(it.humour),
        contribution: num(it.contribution),
        points: num(it.points),
        createdAt: row.created_at,
      });
    }
    for (const r of Array.isArray(meta.reasons) ? meta.reasons : []) {
      if (typeof r === "string" && r) featureReasons.push(r);
    }
  }

  return { items, featureReasons, totalPoints };
}

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

export type TtsFeedItem = {
  id: string;
  chatMessageId: string | null;
  authorName: string | null;
  origin: string;
  text: string;
  status: string;
  reason: string | null;
  audioPath: string | null;
  createdAt: string;
};

export async function getTtsFeedAction(
  streamId: string
): Promise<TtsFeedItem[]> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { data, error } = await supabaseAdmin
    .from("tts_requests")
    .select(
      "id, chat_message_id, author_name, origin, text, status, reason, audio_path, created_at"
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error(error);
    throw new Error("Failed to load TTS requests");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    chatMessageId: r.chat_message_id,
    authorName: r.author_name,
    origin: r.origin,
    text: r.text,
    status: r.status,
    reason: r.reason,
    audioPath: r.audio_path,
    createdAt: r.created_at,
  }));
}

export async function approveTtsAction(
  id: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data, error } = await supabaseAdmin
    .from("tts_requests")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "suggested")
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to approve");
  }
  if (!data?.length) {
    return { error: "That request is no longer pending." };
  }
  return { data: { ok: true } };
}

export async function dismissTtsAction(
  id: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data, error } = await supabaseAdmin
    .from("tts_requests")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("status", "suggested")
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to dismiss");
  }
  if (!data?.length) {
    return { error: "That request is no longer pending." };
  }
  return { data: { ok: true } };
}

export type AskFeedItem = {
  id: string;
  chatMessageId: string | null;
  authorName: string | null;
  origin: string;
  question: string;
  answer: string | null;
  reason: string | null;
  status: string;
  includeAnswer: boolean;
  createdAt: string;
};

export async function getAskFeedAction(
  streamId: string
): Promise<AskFeedItem[]> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { data, error } = await supabaseAdmin
    .from("ask_requests")
    .select(
      "id, chat_message_id, author_name, origin, question, answer, reason, status, include_answer, created_at"
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error(error);
    throw new Error("Failed to load ask requests");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    chatMessageId: r.chat_message_id,
    authorName: r.author_name,
    origin: r.origin,
    question: r.question,
    answer: r.answer,
    reason: r.reason,
    status: r.status,
    includeAnswer: r.include_answer,
    createdAt: r.created_at,
  }));
}

export async function approveAskAction(
  id: string,
  includeAnswer: boolean
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data, error } = await supabaseAdmin
    .from("ask_requests")
    .update({
      status: "approved",
      include_answer: includeAnswer,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "suggested")
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to approve");
  }
  if (!data?.length) {
    return { error: "That question is no longer pending." };
  }
  return { data: { ok: true } };
}

export async function dismissAskAction(
  id: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data, error } = await supabaseAdmin
    .from("ask_requests")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("status", "suggested")
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to dismiss");
  }
  if (!data?.length) {
    return { error: "That question is no longer pending." };
  }
  return { data: { ok: true } };
}

export type ClipMarker = {
  id: string;
  chatMessageId: string | null;
  authorName: string | null;
  origin: string;
  streamTimeS: number;
  snippet: string | null;
  createdAt: string;
  streamTitle: string | null;
};

export async function getClipMarkersAction(
  streamId: string | null
): Promise<ClipMarker[]> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }

  let targetStreamId = streamId;
  let streamTitle: string | null = null;
  if (!targetStreamId) {
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("streams")
      .select("id, title")
      .eq("channel_id", owned.data.id)
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) {
      console.error(latestError);
      throw new Error("Failed to resolve the latest stream");
    }
    if (!latest) {
      return [];
    }
    targetStreamId = latest.id;
    streamTitle = latest.title;
  }

  const { data, error } = await supabaseAdmin
    .from("clip_markers")
    .select(
      "id, chat_message_id, author_name, origin, stream_time_s, snippet, created_at"
    )
    .eq("stream_id", targetStreamId)
    .order("stream_time_s", { ascending: true })
    .limit(100);
  if (error) {
    console.error(error);
    throw new Error("Failed to load clip markers");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    chatMessageId: r.chat_message_id,
    authorName: r.author_name,
    origin: r.origin,
    streamTimeS: r.stream_time_s,
    snippet: r.snippet,
    createdAt: r.created_at,
    streamTitle,
  }));
}

export async function requestWrapupAction(
  streamId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data, error } = await supabaseAdmin
    .from("streams")
    .update({ wrapup_requested_at: new Date().toISOString() })
    .eq("id", streamId)
    .is("wrapup_requested_at", null)
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to request the wrap-up");
  }
  if (!data?.length) {
    return { error: "Wrap-up was already requested for this stream." };
  }
  return { data: { ok: true } };
}
