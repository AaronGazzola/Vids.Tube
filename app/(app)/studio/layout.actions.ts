"use server";

import type { OwnerStream } from "@/app/(app)/studio/layout.types";
import type { ActionResult } from "@/app/layout.types";
import { vodAssetUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

async function getOwnedChannelId(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "No channel found for your account." };
  }

  return { data: channel.id };
}

export async function listOwnerStreamsAction(): Promise<
  ActionResult<OwnerStream[]>
> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const channelId = owned.data;

  const { data: streams, error: streamError } = await supabaseAdmin
    .from("streams")
    .select("id, title, started_at, thumbnail_path")
    .eq("channel_id", channelId)
    .order("started_at", { ascending: false, nullsFirst: false });

  if (streamError) {
    console.error(streamError);
    throw new Error("Failed to load streams");
  }
  if (!streams || streams.length === 0) {
    return { data: [] };
  }

  const streamIds = streams.map((stream) => stream.id);

  const { data: videos, error: videoError } = await supabaseAdmin
    .from("videos")
    .select("id, source_stream_id, duration_s, status, mp4_path, thumbnail_path")
    .in("source_stream_id", streamIds);

  if (videoError) {
    console.error(videoError);
    throw new Error("Failed to load videos");
  }

  const videoByStream = new Map<string, (typeof videos)[number]>();
  for (const video of videos ?? []) {
    if (!video.source_stream_id) {
      continue;
    }
    const existing = videoByStream.get(video.source_stream_id);
    if (!existing || (!existing.mp4_path && video.mp4_path)) {
      videoByStream.set(video.source_stream_id, video);
    }
  }

  const labelled = new Set<string>();
  for (const table of ["stream_sections", "stream_moments"] as const) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("stream_id")
      .in("stream_id", streamIds);
    if (error) {
      console.error(error);
      throw new Error("Failed to load timeline coverage");
    }
    for (const row of data ?? []) {
      labelled.add(row.stream_id);
    }
  }

  const rows: OwnerStream[] = streams.map((stream) => {
    const video = videoByStream.get(stream.id);
    const hasVod = !!video && video.status === "ready" && !!video.mp4_path;
    return {
      id: stream.id,
      title: stream.title ?? "Untitled stream",
      startedAt: stream.started_at,
      durationS: video?.duration_s ?? null,
      thumbnailUrl:
        vodAssetUrl(video?.thumbnail_path) ??
        vodAssetUrl(stream.thumbnail_path) ??
        null,
      videoId: video?.id ?? null,
      hasVod,
      hasTimeline: labelled.has(stream.id),
    };
  });

  return { data: rows };
}
