"use server";

import { createClient } from "@/supabase/server-client";
import { randomBytes } from "crypto";

function generateStreamKey() {
  return `vt_live_${randomBytes(24).toString("hex")}`;
}

async function getOwnedChannel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
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
    throw new Error("No channel found");
  }

  return { supabase, channel };
}

export async function getStreamKeyAction() {
  const { supabase, channel } = await getOwnedChannel();

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

export async function regenerateStreamKeyAction() {
  const { supabase, channel } = await getOwnedChannel();

  const key = generateStreamKey();
  const { error } = await supabase
    .from("stream_keys")
    .upsert({ channel_id: channel.id, key }, { onConflict: "channel_id" });

  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate stream key");
  }

  return { key };
}
