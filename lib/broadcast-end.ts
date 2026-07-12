import { supabaseAdmin } from "@/supabase/admin-client";

type VodSourceStream = {
  id: string;
  channel_id: string;
  title: string | null;
  description: string | null;
  thumbnail_path: string | null;
};

// Create the processing VOD row at go-live so the VM finalize (which can fire on
// any disconnect) always has a row to attach the recording to. The row stays
// hidden (processing) until the broadcast is ended.
export async function ensureProcessingVod(
  stream: VodSourceStream
): Promise<void> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("videos")
    .select("id")
    .eq("source_stream_id", stream.id)
    .order("created_at", { ascending: false })
    .limit(1)
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

// On End, publish the VOD if its recording has already been finalized (mp4
// present). If the finalize hasn't arrived yet, the recording hook publishes it
// once it lands (it gates on the stream being ended).
export async function publishVodForStream(streamId: string): Promise<void> {
  const { data: vod, error } = await supabaseAdmin
    .from("videos")
    .select("id, mp4_path, status")
    .eq("source_stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load VOD");
  }
  if (!vod || vod.status !== "processing" || !vod.mp4_path) {
    return;
  }
  const { error: updateError } = await supabaseAdmin
    .from("videos")
    .update({ status: "ready", published_at: new Date().toISOString() })
    .eq("id", vod.id);
  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to publish VOD");
  }
}
