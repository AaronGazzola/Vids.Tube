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

const REAP_AFTER_MS = 60 * 60 * 1000;

// Self-heal stuck VODs: a `processing` row whose source stream has been ended
// for over an hour will never finalize normally. Publish it if a recording
// landed (late finalize), otherwise mark it failed so it can't shadow future
// recording-hook matches. Runs from the ingest heartbeat and the owner's
// /live query — no cron needed.
export async function reapStaleProcessingVods(channelId: string): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from("videos")
    .select("id, mp4_path, source_stream_id, created_at")
    .eq("channel_id", channelId)
    .eq("status", "processing");
  if (error) {
    console.error(error);
    return;
  }
  const now = Date.now();
  for (const row of rows ?? []) {
    let endedAtMs: number | null = null;
    if (row.source_stream_id) {
      const { data: stream } = await supabaseAdmin
        .from("streams")
        .select("status, ended_at")
        .eq("id", row.source_stream_id)
        .maybeSingle();
      if (!stream || stream.status !== "ended") {
        continue;
      }
      endedAtMs = stream.ended_at
        ? new Date(stream.ended_at).getTime()
        : new Date(row.created_at).getTime();
    } else {
      endedAtMs = new Date(row.created_at).getTime();
    }
    if (now - endedAtMs < REAP_AFTER_MS) {
      continue;
    }
    if (row.mp4_path) {
      const { error: publishError } = await supabaseAdmin
        .from("videos")
        .update({
          status: "ready",
          published_at: row.source_stream_id
            ? await broadcastStartedAt(row.source_stream_id)
            : row.created_at,
        })
        .eq("id", row.id)
        .eq("status", "processing");
      if (publishError) {
        console.error(publishError);
      } else {
        console.error(`reaper: published stuck VOD ${row.id} (late finalize)`);
      }
    } else {
      const { error: failError } = await supabaseAdmin
        .from("videos")
        .update({ status: "failed" })
        .eq("id", row.id)
        .eq("status", "processing");
      if (failError) {
        console.error(failError);
      } else {
        console.error(`reaper: failed stuck VOD ${row.id} (no recording)`);
      }
    }
  }
}

// A recording is dated by when its broadcast started, not by when processing
// happened to finish. The importer has always dated an imported VOD by its start
// (`scripts/import-youtube-vods.ts`), so publishing at `now()` made live
// recordings the odd ones out: the studio lists a broadcast by `started_at`
// while the channel listed it by a timestamp minutes after it ended, which for a
// stream ending after local midnight put the two pages on different days.
export async function broadcastStartedAt(streamId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("streams")
    .select("started_at, live_at")
    .eq("id", streamId)
    .maybeSingle();
  return data?.started_at ?? data?.live_at ?? new Date().toISOString();
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
    .update({
      status: "ready",
      published_at: await broadcastStartedAt(streamId),
    })
    .eq("id", vod.id);
  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to publish VOD");
  }
}
