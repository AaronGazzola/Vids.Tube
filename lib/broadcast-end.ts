import { supabaseAdmin } from "@/supabase/admin-client";

type EndableStream = {
  id: string;
  channel_id: string;
  status: string;
  title: string | null;
  description: string | null;
  thumbnail_path: string | null;
};

export async function endBroadcastSession(stream: EndableStream): Promise<void> {
  const wasLive = stream.status === "live";

  const { error: endError } = await supabaseAdmin
    .from("streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", stream.id);
  if (endError) {
    console.error(endError);
    throw new Error("Failed to end broadcast");
  }

  if (!wasLive) {
    return;
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("videos")
    .select("id")
    .eq("source_stream_id", stream.id)
    .eq("status", "processing")
    .maybeSingle();
  if (existingError) {
    console.error(existingError);
    throw new Error("Failed to check existing VOD");
  }
  if (existing) {
    return;
  }

  const { error: insertError } = await supabaseAdmin.from("videos").insert({
    channel_id: stream.channel_id,
    source_stream_id: stream.id,
    status: "processing",
    title: stream.title,
    description: stream.description,
    thumbnail_path: stream.thumbnail_path,
  });
  if (insertError) {
    console.error(insertError);
    throw new Error("Failed to create VOD");
  }
}
