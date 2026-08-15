import { supabaseAdmin } from "@/supabase/admin-client";
import { opaqueSubject } from "@/lib/overlay-token";

export type OverlayEvent = {
  id: string;
  keyword: string;
  args: string | null;
  at: string;
  // Derived, never stored. The same machinery the token's subject uses: two
  // overlays cannot tell they are talking to the same chatter, and one overlay
  // cannot follow a chatter between channels.
  actor: string;
  // For the on-screen moment. NOT an identifier: not stable, not unique, and
  // nothing should ever be keyed to it.
  actorName: string | null;
};

export const OVERLAY_EVENTS_LIMIT = 50;

export async function overlayEventsFor({
  channelId,
  overlayId,
  secret,
  sinceIso,
  limit = OVERLAY_EVENTS_LIMIT,
}: {
  channelId: string;
  overlayId: string;
  secret: string;
  sinceIso: string;
  limit?: number;
}): Promise<OverlayEvent[]> {
  const { data: commands, error: commandError } = await supabaseAdmin
    .from("chat_commands")
    .select("keyword")
    .eq("channel_id", channelId)
    .eq("overlay_id", overlayId);
  if (commandError) {
    console.error(commandError);
    throw new Error("Failed to read the overlay's commands");
  }
  const keywords = (commands ?? []).map((row) => row.keyword);
  if (keywords.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("command_events")
    .select(
      "id, keyword, args, created_at, participant_key, chat_messages (author_name)"
    )
    .eq("channel_id", channelId)
    .eq("status", "executed")
    .in("keyword", keywords)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error(error);
    throw new Error("Failed to read overlay events");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    keyword: row.keyword,
    args: row.args,
    at: row.created_at,
    actor: opaqueSubject(overlayId, channelId, row.participant_key, secret),
    actorName: row.chat_messages?.author_name ?? null,
  }));
}
