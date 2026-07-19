"use server";

import type { GoalProgressResponse } from "@/app/layout.types";
import { computeGoalProgress } from "@/lib/goals";
import { isLiveAndFresh } from "@/lib/stream";
import { fetchSubs, fetchVideoData } from "@/lib/youtube";
import { createClient } from "@/supabase/server-client";

const INACTIVE = (isLive: boolean): GoalProgressResponse => ({
  active: false,
  isLive,
  metrics: null,
});

// One YouTube fetch per video per minute, shared by every overlay source
// polling this action. liveChat quota is the scarce resource; without this,
// each OBS goal source costs 2 units per poll.
const YT_COUNTS_TTL_MS = 60_000;
type YtCounts = { subs: number; likes: number; viewers: number };
const ytCountsCache = new Map<
  string,
  { at: number; promise: Promise<YtCounts> }
>();

function fetchCountsShared(
  videoId: string,
  youtubeChannelId: string | null
): Promise<YtCounts> {
  const hit = ytCountsCache.get(videoId);
  if (hit && Date.now() - hit.at < YT_COUNTS_TTL_MS) {
    return hit.promise;
  }
  const promise = (async () => {
    const video = await fetchVideoData(videoId);
    const subs = await fetchSubs(youtubeChannelId || video.channelId);
    return {
      subs,
      likes: video.likeCount,
      viewers: video.concurrentViewers,
    };
  })();
  ytCountsCache.set(videoId, { at: Date.now(), promise });
  promise.catch(() => ytCountsCache.delete(videoId));
  return promise;
}

export async function getGoalProgressAction(
  channelSlug: string
): Promise<GoalProgressResponse> {
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (!channel) {
    return INACTIVE(false);
  }

  const { data: stream } = await supabase
    .from("streams")
    .select("id, status, last_seen_at, youtube_video_id, youtube_channel_id")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isLive = !!stream && isLiveAndFresh(stream, Date.now());
  if (!stream || !isLive || !stream.youtube_video_id) {
    return INACTIVE(isLive);
  }

  const { data: goals } = await supabase
    .from("stream_goals")
    .select("*")
    .eq("stream_id", stream.id)
    .maybeSingle();
  if (!goals || !goals.started_at) {
    return INACTIVE(isLive);
  }

  try {
    const counts = await fetchCountsShared(
      stream.youtube_video_id,
      stream.youtube_channel_id
    );
    const metrics = computeGoalProgress(
      counts,
      {
        subs: goals.baseline_subs ?? 0,
        likes: goals.baseline_likes ?? 0,
        viewers: goals.baseline_viewers ?? 0,
      },
      {
        subs: goals.subs_goal,
        likes: goals.likes_goal,
        viewers: goals.viewers_goal,
      }
    );
    return { active: true, isLive, metrics };
  } catch (e) {
    console.error(e);
    return INACTIVE(isLive);
  }
}
