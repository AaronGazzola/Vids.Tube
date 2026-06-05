"use server";

import type { ActionResult } from "@/app/layout.types";
import { createClient } from "@/supabase/server-client";
import { randomBytes } from "crypto";

function generateStreamKey() {
  return `vt_live_${randomBytes(24).toString("hex")}`;
}

type OwnedChannel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  channel: { id: string; slug: string };
};

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

  return { data: { supabase, channel } };
}

export async function getStreamKeyAction() {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { supabase, channel } = owned.data;

  const { data, error } = await supabase
    .from("stream_keys")
    .select("key")
    .eq("channel_id", channel.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load stream key");
  }

  return {
    channelId: channel.id,
    channelSlug: channel.slug,
    key: data?.key ?? null,
  };
}

export async function regenerateStreamKeyAction(): Promise<
  ActionResult<{ key: string }>
> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { supabase, channel } = owned.data;

  const key = generateStreamKey();
  const { error } = await supabase
    .from("stream_keys")
    .upsert({ channel_id: channel.id, key }, { onConflict: "channel_id" });

  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate stream key");
  }

  return { data: { key } };
}
