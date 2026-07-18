"use server";

import type { ActionResult } from "@/app/layout.types";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

export type AdminCommand = {
  id: string;
  keyword: string;
  kind: "builtin" | "custom";
  description: string;
  response: string | null;
  cooldownS: number;
  enabled: boolean;
  sortOrder: number;
};

export type CustomCommandInput = {
  keyword: string;
  description: string;
  response: string;
  cooldownS: number;
};

async function getOwnedChannelId(): Promise<ActionResult<string>> {
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
  return { data: channel.id };
}

function validateInput(
  input: CustomCommandInput
): ActionResult<CustomCommandInput> {
  const keyword = input.keyword.trim().toLowerCase().replace(/^!/, "");
  if (!/^[a-z0-9_]{1,24}$/.test(keyword)) {
    return {
      error:
        "Keywords are 1-24 letters, numbers, or underscores (no spaces or symbols).",
    };
  }
  const description = input.description.trim();
  const response = input.response.trim();
  if (!description) {
    return { error: "A short description is required." };
  }
  if (!response) {
    return { error: "A response message is required." };
  }
  const cooldownS = Math.max(0, Math.floor(input.cooldownS) || 0);
  return { data: { keyword, description, response, cooldownS } };
}

export async function getChannelCommandsAdminAction(): Promise<AdminCommand[]> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { data, error } = await supabaseAdmin
    .from("chat_commands")
    .select("id, keyword, kind, description, response, cooldown_s, enabled, sort_order")
    .eq("channel_id", owned.data)
    .order("sort_order", { ascending: true })
    .order("keyword", { ascending: true });
  if (error) {
    console.error(error);
    throw new Error("Failed to load commands");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    keyword: r.keyword,
    kind: r.kind as "builtin" | "custom",
    description: r.description,
    response: r.response,
    cooldownS: r.cooldown_s,
    enabled: r.enabled,
    sortOrder: r.sort_order,
  }));
}

export async function createCustomCommandAction(
  input: CustomCommandInput
): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const valid = validateInput(input);
  if ("error" in valid) {
    return valid;
  }
  const { data, error } = await supabaseAdmin
    .from("chat_commands")
    .insert({
      channel_id: owned.data,
      keyword: valid.data.keyword,
      kind: "custom",
      description: valid.data.description,
      response: valid.data.response,
      cooldown_s: valid.data.cooldownS,
      sort_order: 100,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { error: `!${valid.data.keyword} already exists.` };
    }
    console.error(error);
    throw new Error("Failed to create the command");
  }
  return { data: { id: data.id } };
}

export async function updateCustomCommandAction(
  id: string,
  input: CustomCommandInput
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const valid = validateInput(input);
  if ("error" in valid) {
    return valid;
  }
  const { data, error } = await supabaseAdmin
    .from("chat_commands")
    .update({
      keyword: valid.data.keyword,
      description: valid.data.description,
      response: valid.data.response,
      cooldown_s: valid.data.cooldownS,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("channel_id", owned.data)
    .eq("kind", "custom")
    .select("id");
  if (error) {
    if (error.code === "23505") {
      return { error: `!${valid.data.keyword} already exists.` };
    }
    console.error(error);
    throw new Error("Failed to update the command");
  }
  if (!data?.length) {
    return { error: "Only custom commands can be edited." };
  }
  return { data: { ok: true } };
}

export async function deleteCustomCommandAction(
  id: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const { data, error } = await supabaseAdmin
    .from("chat_commands")
    .delete()
    .eq("id", id)
    .eq("channel_id", owned.data)
    .eq("kind", "custom")
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to delete the command");
  }
  if (!data?.length) {
    return { error: "Only custom commands can be deleted." };
  }
  return { data: { ok: true } };
}
