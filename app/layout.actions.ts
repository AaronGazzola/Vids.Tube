"use server";

import { createClient } from "@/supabase/server-client";
import { supabaseAdmin } from "@/supabase/admin-client";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { STALE_MS } from "@/lib/stream";
import {
  isReservedHandle,
  isValidHandle,
  normalizeHandle,
  HANDLE_REQUIREMENT,
} from "@/lib/handle";
import type {
  ActionResult,
  AuthorIdentity,
  Channel,
  ChatMessage,
  ChatMessageRow,
  CreateChannelInput,
  HandleAvailability,
  SignUpDecision,
  SignUpInput,
  Stream,
  UpdateChannelInput,
} from "./layout.types";

const UNIQUE_VIOLATION = "23505";

export async function signUpAction(
  input: SignUpInput
): Promise<ActionResult<SignUpDecision>> {
  const handle = normalizeHandle(input.handle);

  if (!isValidHandle(handle)) {
    return { error: HANDLE_REQUIREMENT };
  }
  if (isReservedHandle(handle)) {
    return { error: "That handle is unavailable." };
  }

  const email = input.email.trim();

  const { data: status, error: statusError } = await supabaseAdmin.rpc(
    "email_signup_status",
    { p_email: email }
  );

  if (statusError) {
    console.error(statusError);
    throw new Error("Failed to start signup");
  }

  const action =
    status === "confirmed"
      ? "signin"
      : status === "unconfirmed"
        ? "resend"
        : "signup";

  return { data: { action, handle, email } };
}

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

export async function getMyChannelAction(): Promise<Channel | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch your channel");
  }

  return data;
}

export async function checkHandleAvailabilityAction(
  rawHandle: string
): Promise<ActionResult<HandleAvailability>> {
  const handle = normalizeHandle(rawHandle);

  if (!isValidHandle(handle)) {
    return { error: HANDLE_REQUIREMENT };
  }
  if (isReservedHandle(handle)) {
    return { data: { handle, available: false } };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to check handle availability");
  }

  return { data: { handle, available: !data } };
}

export async function createChannelAction(
  input: CreateChannelInput
): Promise<ActionResult<Channel>> {
  const handle = normalizeHandle(input.handle);

  if (!isValidHandle(handle)) {
    return { error: HANDLE_REQUIREMENT };
  }
  if (isReservedHandle(handle)) {
    return { error: "That handle is unavailable." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a channel." };
  }

  const name = input.name?.trim() || handle;

  const { data, error } = await supabase
    .from("channels")
    .insert({ owner_user_id: user.id, handle, slug: handle, name })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      if (error.message.includes("owner_user_id")) {
        return { error: "You already have a channel." };
      }
      return { error: "That handle is taken." };
    }
    console.error(error);
    throw new Error("Failed to create channel");
  }

  return { data };
}

export async function updateChannelAction(
  input: UpdateChannelInput
): Promise<ActionResult<Channel>> {
  const handle = normalizeHandle(input.handle);
  const name = input.name.trim();

  if (!name) {
    return { error: "Channel name cannot be empty." };
  }
  if (!isValidHandle(handle)) {
    return { error: HANDLE_REQUIREMENT };
  }
  if (isReservedHandle(handle)) {
    return { error: "That handle is unavailable." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to edit your channel." };
  }

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, owner_user_id")
    .eq("id", input.channelId)
    .maybeSingle();

  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "Channel not found." };
  }
  if (channel.owner_user_id !== user.id) {
    return { error: "You're not authorized to edit this channel." };
  }

  const { data, error } = await supabase
    .from("channels")
    .update({
      name,
      handle,
      slug: handle,
      description: input.description.trim(),
    })
    .eq("id", input.channelId)
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "That handle is taken." };
    }
    console.error(error);
    throw new Error("Failed to update channel");
  }

  return { data };
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

  const authorByUser = await resolveAuthorIdentities(
    supabase,
    data.map((m) => m.user_id)
  );

  return data.map((m) => ({
    ...m,
    author: authorByUser.get(m.user_id) ?? null,
  }));
}

export async function getAuthorIdentityAction(
  userId: string
): Promise<AuthorIdentity> {
  const supabase = await createClient();
  const map = await resolveAuthorIdentities(supabase, [userId]);
  return map.get(userId) ?? null;
}

export async function postChatMessageAction(
  streamId: string,
  body: string
): Promise<ActionResult<ChatMessageRow>> {
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
