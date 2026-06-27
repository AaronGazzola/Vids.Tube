"use server";

import type { FeaturedMessageWithAuthor } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { authorFromRow } from "@/lib/featured-author";
import { createClient } from "@/supabase/server-client";

export async function getFeaturedMessagesAction(
  streamId: string
): Promise<FeaturedMessageWithAuthor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("featured_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("featured_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch featured messages");
  }

  const userIds = data
    .map((m) => m.user_id)
    .filter((id): id is string => !!id);
  const authorByUser = await resolveAuthorIdentities(supabase, userIds);

  return data.map((m) => ({
    ...m,
    author: authorFromRow(m.origin, m, m.user_id ? authorByUser.get(m.user_id) ?? null : null),
  }));
}
