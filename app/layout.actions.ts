"use server";

import { createClient } from "@/supabase/server-client";
import { STALE_MS } from "@/lib/stream";
import type {
  ActionResult,
  Channel,
  ChatMessage,
  Stream,
} from "./layout.types";

export async function getOwnerChannelAction(): Promise<Channel | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel");
  }

  return data;
}

export async function getLiveStreamAction(
  channelId: string
): Promise<Stream | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch stream");
  }

  if (!data) {
    return null;
  }

  if (data.status === "live") {
    const lastSeen = data.last_seen_at
      ? new Date(data.last_seen_at).getTime()
      : 0;
    if (Date.now() - lastSeen > STALE_MS) {
      return { ...data, status: "ended" };
    }
  }

  return data;
}

export async function getChatMessagesAction(
  streamId: string
): Promise<ChatMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch chat messages");
  }

  return data;
}

export async function postChatMessageAction(
  streamId: string,
  body: string
): Promise<ActionResult<ChatMessage>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to send messages." };
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return { error: "Message cannot be empty." };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ stream_id: streamId, user_id: user.id, body: trimmed })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to post message");
  }

  return { data };
}
