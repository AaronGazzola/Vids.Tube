"use server";

import type { FeaturedMessageWithAuthor } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
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

  const authorByUser = await resolveAuthorIdentities(
    supabase,
    data.map((m) => m.user_id)
  );

  return data.map((m) => ({
    ...m,
    author: authorByUser.get(m.user_id) ?? null,
  }));
}
