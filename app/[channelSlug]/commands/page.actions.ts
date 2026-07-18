"use server";

import { createClient } from "@/supabase/server-client";
import type { ChannelCommandGuide } from "./page.types";

export async function getChannelCommandsAction(
  slug: string
): Promise<ChannelCommandGuide | null> {
  const supabase = await createClient();

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, name, handle")
    .eq("slug", slug)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return null;
  }

  const { data: commands, error: commandsError } = await supabase
    .from("chat_commands")
    .select("keyword, description, cooldown_s, max_per_stream")
    .eq("channel_id", channel.id)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (commandsError) {
    console.error(commandsError);
    throw new Error("Failed to load commands");
  }

  return {
    channelName: channel.name,
    handle: channel.handle,
    commands: commands ?? [],
  };
}
