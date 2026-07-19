"use server";

import { isLiveAndFresh } from "@/lib/stream";
import { createClient } from "@/supabase/server-client";

export type BreakStateResponse = {
  isLive: boolean;
  breakEndsAt: string | null;
};

export async function getBreakStateAction(
  channelSlug: string
): Promise<BreakStateResponse> {
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (!channel) {
    return { isLive: false, breakEndsAt: null };
  }

  const { data: stream } = await supabase
    .from("streams")
    .select("status, last_seen_at, break_ends_at")
    .eq("channel_id", channel.id)
    .in("status", ["scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!stream) {
    return { isLive: false, breakEndsAt: null };
  }

  return {
    isLive: isLiveAndFresh(stream, Date.now()),
    breakEndsAt: stream.break_ends_at,
  };
}
