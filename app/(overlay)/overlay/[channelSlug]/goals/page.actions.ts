"use server";

import type {
  GoalMetric,
  GoalProgressResponse,
  YouTubeVideoData,
} from "@/app/layout.types";
import { computeGoalProgress } from "@/lib/goals";
import { isLiveAndFresh } from "@/lib/stream";
import { fetchSubs, fetchVideoData } from "@/lib/youtube";
import { createClient } from "@/supabase/server-client";

const INACTIVE = (
  isLive: boolean,
  targets: Record<GoalMetric, number> | null = null
): GoalProgressResponse => ({
  active: false,
  isLive,
  metrics: null,
  targets,
});

// One YouTube fetch per key per TTL, shared by every overlay source polling
// this action. Quota is the scarce resource (10k units/day; chat polling at 10s
// spends ~7.2k of it over a 4h stream), so the two reads are cached separately:
// likes/viewers move constantly and cost 1 unit (videos.list), subs barely move
// and cost 1 unit (channels.list). 10s + 60s = 7 units/min ≈ 1.7k units per 4h
// stream. Refreshing both at 10s would cost 2.9k and blow the daily budget.
const VIDEO_TTL_MS = 10_000;
const SUBS_TTL_MS = 60_000;
type YtCounts = { subs: number; likes: number; viewers: number };
const videoCache = new Map<
  string,
  { at: number; promise: Promise<YouTubeVideoData> }
>();
const subsCache = new Map<string, { at: number; promise: Promise<number> }>();

function fetchVideoShared(videoId: string): Promise<YouTubeVideoData> {
  const hit = videoCache.get(videoId);
  if (hit && Date.now() - hit.at < VIDEO_TTL_MS) {
    return hit.promise;
  }
  const promise = fetchVideoData(videoId);
  videoCache.set(videoId, { at: Date.now(), promise });
  promise.catch(() => videoCache.delete(videoId));
  return promise;
}

function fetchSubsShared(channelId: string): Promise<number> {
  const hit = subsCache.get(channelId);
  if (hit && Date.now() - hit.at < SUBS_TTL_MS) {
    return hit.promise;
  }
  const promise = fetchSubs(channelId);
  subsCache.set(channelId, { at: Date.now(), promise });
  promise.catch(() => subsCache.delete(channelId));
  return promise;
}

async function fetchCountsShared(
  videoId: string,
  youtubeChannelId: string | null
): Promise<YtCounts> {
  const video = await fetchVideoShared(videoId);
  const subs = await fetchSubsShared(youtubeChannelId || video.channelId);
  return {
    subs,
    likes: video.likeCount,
    viewers: video.concurrentViewers,
  };
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

  // Read the saved goals for the latest broadcast whatever its state, so an
  // idle bar can be drawn against the owner's targets rather than the defaults.
  const { data: goals } = stream
    ? await supabase
        .from("stream_goals")
        .select("*")
        .eq("stream_id", stream.id)
        .maybeSingle()
    : { data: null };

  const targets = goals
    ? {
        subs: goals.subs_goal,
        likes: goals.likes_goal,
        viewers: goals.viewers_goal,
      }
    : null;

  if (!stream || !isLive || !stream.youtube_video_id) {
    return INACTIVE(isLive, targets);
  }
  if (!goals || !goals.started_at) {
    return INACTIVE(isLive, targets);
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
    return { active: true, isLive, metrics, targets };
  } catch (e) {
    console.error(e);
    return INACTIVE(isLive, targets);
  }
}
