"use server";

import type {
  ActionResult,
  ViewerScoreWithAuthor,
} from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { fetchVideoData, parseVideoId } from "@/lib/youtube";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

type OwnedChannel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  channel: { id: string; slug: string };
};

async function getOwnedChannel(): Promise<ActionResult<OwnedChannel>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id, slug")
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

  return { data: { supabase, channel } };
}

export type OverlayContext = {
  channelSlug: string;
  streamId: string | null;
  streamStatus: string | null;
  enabled: boolean;
  youtubeVideoId: string | null;
};

export async function getOverlayContextAction(): Promise<OverlayContext> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, youtube_video_id")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }

  let enabled = false;
  if (stream) {
    const { data: state, error: stateError } = await supabaseAdmin
      .from("chat_scoring_state")
      .select("enabled")
      .eq("stream_id", stream.id)
      .maybeSingle();

    if (stateError) {
      console.error(stateError);
      throw new Error("Failed to load scoring state");
    }
    enabled = state?.enabled ?? false;
  }

  return {
    channelSlug: channel.slug,
    streamId: stream?.id ?? null,
    streamStatus: stream?.status ?? null,
    enabled,
    youtubeVideoId: stream?.youtube_video_id ?? null,
  };
}

export async function setStreamYoutubeVideoAction(
  streamId: string,
  urlOrId: string
): Promise<ActionResult<{ youtubeVideoId: string | null }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id")
    .eq("id", streamId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.channel_id !== channel.id) {
    return { error: "That broadcast is not on your channel." };
  }

  const trimmed = urlOrId.trim();
  if (!trimmed) {
    const { error: clearError } = await supabaseAdmin
      .from("streams")
      .update({ youtube_video_id: null, youtube_channel_id: null })
      .eq("id", streamId);
    if (clearError) {
      console.error(clearError);
      throw new Error("Failed to clear YouTube video");
    }
    return { data: { youtubeVideoId: null } };
  }

  const videoId = parseVideoId(trimmed);
  if (!videoId) {
    return { error: "Couldn't read a YouTube video id from that URL." };
  }

  let channelId = "";
  try {
    const video = await fetchVideoData(videoId);
    channelId = video.channelId;
  } catch (e) {
    console.error(e);
    return {
      error:
        "Couldn't fetch that YouTube video — check the URL and that it's public.",
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("streams")
    .update({
      youtube_video_id: videoId,
      youtube_channel_id: channelId || null,
    })
    .eq("id", streamId);

  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to save YouTube video");
  }

  return { data: { youtubeVideoId: videoId } };
}

export async function setScoringEnabledAction(
  streamId: string,
  enabled: boolean
): Promise<ActionResult<{ enabled: boolean }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id")
    .eq("id", streamId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.channel_id !== channel.id) {
    return { error: "That broadcast is not on your channel." };
  }

  const { error: upsertError } = await supabaseAdmin
    .from("chat_scoring_state")
    .upsert(
      {
        stream_id: streamId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stream_id" }
    );

  if (upsertError) {
    console.error(upsertError);
    throw new Error("Failed to update scoring state");
  }

  return { data: { enabled } };
}

export async function getViewerLeaderboardAction(
  streamId: string
): Promise<ViewerScoreWithAuthor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("viewer_scores")
    .select("*")
    .eq("stream_id", streamId)
    .order("features_count", { ascending: false })
    .order("total_score", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    throw new Error("Failed to load leaderboard");
  }

  const authorByUser = await resolveAuthorIdentities(
    supabase,
    data.map((v) => v.user_id)
  );

  return data.map((v) => ({
    ...v,
    author: authorByUser.get(v.user_id) ?? null,
  }));
}
