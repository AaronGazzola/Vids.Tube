"use server";

import type { TimelineStreamDetail } from "@/app/(app)/studio/timeline/[streamId]/page.types";
import type { ActionResult } from "@/app/layout.types";
import { vodAssetUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStreamTimelineAction(
  streamId: string
): Promise<ActionResult<TimelineStreamDetail>> {
  if (!UUID_RE.test(streamId)) {
    return { error: "That stream could not be found." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "No channel found for your account." };
  }

  const { data: stream, error: streamError } = await supabaseAdmin
    .from("streams")
    .select("id, title, started_at, channel_id")
    .eq("id", streamId)
    .maybeSingle();
  if (streamError) {
    console.error(streamError);
    throw new Error("Failed to load stream");
  }
  if (!stream || stream.channel_id !== channel.id) {
    return { error: "That stream could not be found." };
  }

  const { data: videos, error: videoError } = await supabaseAdmin
    .from("videos")
    .select("mp4_path, duration_s, width, height, thumbnail_path, status")
    .eq("source_stream_id", streamId);
  if (videoError) {
    console.error(videoError);
    throw new Error("Failed to load video");
  }
  const video =
    (videos ?? []).find((row) => row.status === "ready" && row.mp4_path) ??
    (videos ?? [])[0] ??
    null;

  const [sections, moments, chapters] = await Promise.all([
    supabaseAdmin
      .from("stream_sections")
      .select("*")
      .eq("stream_id", streamId)
      .order("start_s", { ascending: true }),
    supabaseAdmin
      .from("stream_moments")
      .select("*")
      .eq("stream_id", streamId)
      .order("start_s", { ascending: true }),
    supabaseAdmin
      .from("stream_chapters")
      .select("*")
      .eq("stream_id", streamId)
      .order("start_s", { ascending: true }),
  ]);

  for (const result of [sections, moments, chapters]) {
    if (result.error) {
      console.error(result.error);
      throw new Error("Failed to load timeline");
    }
  }

  return {
    data: {
      streamId,
      title: stream.title ?? "Untitled stream",
      startedAt: stream.started_at,
      vod: {
        src: vodAssetUrl(video?.mp4_path),
        durationS: video?.duration_s ?? 0,
        width: video?.width ?? null,
        height: video?.height ?? null,
        poster: vodAssetUrl(video?.thumbnail_path),
      },
      sections: sections.data ?? [],
      moments: moments.data ?? [],
      chapters: chapters.data ?? [],
    },
  };
}
