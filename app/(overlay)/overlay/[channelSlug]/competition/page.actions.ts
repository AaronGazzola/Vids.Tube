"use server";

import type { ViewerScoreWithAuthor } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { authorFromRow } from "@/lib/featured-author";
import { isLiveAndFresh } from "@/lib/stream";
import { createClient } from "@/supabase/server-client";

export async function getCompetitionAction(
  channelSlug: string
): Promise<ViewerScoreWithAuthor[]> {
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (!channel) {
    return [];
  }

  const { data: stream } = await supabase
    .from("streams")
    .select("id, status, last_seen_at")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!stream || !isLiveAndFresh(stream, Date.now())) {
    return [];
  }

  const { data, error } = await supabase
    .from("viewer_scores")
    .select("*")
    .eq("stream_id", stream.id)
    .order("total_score", { ascending: false })
    .limit(24);
  if (error) {
    console.error(error);
    throw new Error("Failed to load competition");
  }

  const userIds = data
    .map((v) => v.user_id)
    .filter((id): id is string => !!id);
  const authorByUser = await resolveAuthorIdentities(supabase, userIds);

  return data.map((v) => ({
    ...v,
    author: authorFromRow(
      v.origin,
      v,
      v.user_id ? authorByUser.get(v.user_id) ?? null : null
    ),
  }));
}
