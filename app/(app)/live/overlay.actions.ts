"use server";

import type {
  ActionResult,
  ViewerScoreWithAuthor,
} from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { authorFromRow } from "@/lib/featured-author";
import { fetchSubs, fetchVideoData, parseVideoId } from "@/lib/youtube";
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
  streamTitle: string | null;
  enabled: boolean;
  youtubeVideoId: string | null;
  goals: { subs: number; likes: number; viewers: number } | null;
  goalsStarted: boolean;
};

export async function getOverlayContextAction(): Promise<OverlayContext> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, title, youtube_video_id")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
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

  let goals: OverlayContext["goals"] = null;
  let goalsStarted = false;
  if (stream) {
    const { data: g } = await supabaseAdmin
      .from("stream_goals")
      .select("subs_goal, likes_goal, viewers_goal, started_at")
      .eq("stream_id", stream.id)
      .maybeSingle();
    if (g) {
      goals = { subs: g.subs_goal, likes: g.likes_goal, viewers: g.viewers_goal };
      goalsStarted = !!g.started_at;
    }
  }

  return {
    channelSlug: channel.slug,
    streamId: stream?.id ?? null,
    streamStatus: stream?.status ?? null,
    streamTitle: stream?.title ?? null,
    enabled,
    youtubeVideoId: stream?.youtube_video_id ?? null,
    goals,
    goalsStarted,
  };
}

export async function setGoalsAction(
  streamId: string,
  targets: { subs: number; likes: number; viewers: number }
): Promise<ActionResult<{ ok: true }>> {
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

  const { error: upsertError } = await supabaseAdmin.from("stream_goals").upsert(
    {
      stream_id: streamId,
      subs_goal: Math.max(0, Math.round(targets.subs)),
      likes_goal: Math.max(0, Math.round(targets.likes)),
      viewers_goal: Math.max(0, Math.round(targets.viewers)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stream_id" }
  );
  if (upsertError) {
    console.error(upsertError);
    throw new Error("Failed to save goals");
  }

  return { data: { ok: true } };
}

export async function startGoalsAction(
  streamId: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id, youtube_video_id, youtube_channel_id")
    .eq("id", streamId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.channel_id !== channel.id) {
    return { error: "That broadcast is not on your channel." };
  }
  if (!stream.youtube_video_id) {
    return { error: "Set the YouTube video first, then start goals." };
  }

  let counts: { subs: number; likes: number; viewers: number };
  try {
    const video = await fetchVideoData(stream.youtube_video_id);
    const subs = await fetchSubs(stream.youtube_channel_id || video.channelId);
    counts = { subs, likes: video.likeCount, viewers: video.concurrentViewers };
  } catch (e) {
    console.error(e);
    return {
      error: "Couldn't read the YouTube counts — check the video is public.",
    };
  }

  const { error: upsertError } = await supabaseAdmin.from("stream_goals").upsert(
    {
      stream_id: streamId,
      baseline_subs: counts.subs,
      baseline_likes: counts.likes,
      baseline_viewers: counts.viewers,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stream_id" }
  );
  if (upsertError) {
    console.error(upsertError);
    throw new Error("Failed to start goals");
  }

  return { data: { ok: true } };
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
    .order("total_score", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    throw new Error("Failed to load leaderboard");
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
