import { computeGoalProgress, type Counts } from "@/lib/goals";
import { fetchSubs, fetchVideoData } from "@/lib/youtube";
import type { CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

type ScoreRow = {
  participant_key: string;
  total_score: number;
  author_name: string | null;
  user_id: string | null;
};

function callerKey(ctx: CommandContext): string {
  const m = ctx.message;
  return m.origin === "vidstube"
    ? String(m.userId)
    : `youtube:${m.externalAuthorId}`;
}

function mention(ctx: CommandContext): string {
  return `@${(ctx.message.authorName ?? ctx.message.author).replace(/^@+/, "")}`;
}

async function resolveScoreName(row: ScoreRow): Promise<string> {
  if (row.author_name) {
    return row.author_name.replace(/^@+/, "");
  }
  if (row.user_id) {
    const { data } = await supabaseAdmin
      .from("channels")
      .select("handle")
      .eq("owner_user_id", row.user_id)
      .maybeSingle();
    if (data?.handle) {
      return data.handle;
    }
  }
  return "viewer";
}

async function streamScores(streamId: string): Promise<ScoreRow[]> {
  const { data, error } = await supabaseAdmin
    .from("viewer_scores")
    .select("participant_key, total_score, author_name, user_id")
    .eq("stream_id", streamId)
    .order("total_score", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function rankHandler(ctx: CommandContext): Promise<void> {
  const rows = await streamScores(ctx.stream.id);
  const key = callerKey(ctx);
  const index = rows.findIndex((r) => r.participant_key === key);
  if (index === -1) {
    ctx.reply(
      `${mention(ctx)} no points yet this stream — jump into the chat and change that!`
    );
    return;
  }
  ctx.reply(
    `${mention(ctx)} you're #${index + 1} of ${rows.length} with ${rows[index].total_score} points`
  );
}

export async function topHandler(ctx: CommandContext): Promise<void> {
  const rows = await streamScores(ctx.stream.id);
  if (!rows.length) {
    ctx.reply("No points on the board yet — the leaderboard is wide open!");
    return;
  }
  const top = await Promise.all(
    rows.slice(0, 3).map(async (r, i) => {
      const name = await resolveScoreName(r);
      return `#${i + 1} ${name} (${r.total_score})`;
    })
  );
  ctx.reply(`Top chatters: ${top.join(" · ")}`);
}

export async function goalHandler(ctx: CommandContext): Promise<void> {
  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("youtube_video_id, youtube_channel_id")
    .eq("id", ctx.stream.id)
    .maybeSingle();
  const { data: goals } = await supabaseAdmin
    .from("stream_goals")
    .select("subs_goal, likes_goal, viewers_goal, baseline_subs")
    .eq("stream_id", ctx.stream.id)
    .maybeSingle();
  if (!goals || !stream?.youtube_video_id || !stream.youtube_channel_id) {
    ctx.reply("No goals are set up for this stream.");
    return;
  }
  try {
    const video = await fetchVideoData(stream.youtube_video_id);
    const subs = await fetchSubs(stream.youtube_channel_id);
    const counts: Counts = {
      subs,
      likes: video.likeCount,
      viewers: video.concurrentViewers,
    };
    const progress = computeGoalProgress(
      counts,
      { subs: goals.baseline_subs ?? 0, likes: 0, viewers: 0 },
      {
        subs: goals.subs_goal ?? 0,
        likes: goals.likes_goal ?? 0,
        viewers: goals.viewers_goal ?? 0,
      }
    );
    ctx.reply(
      `Goals — subs ${progress.subs.current}/${progress.subs.target || progress.subs.goal}, likes ${progress.likes.current}/${progress.likes.target || progress.likes.goal}, viewers ${progress.viewers.current}/${progress.viewers.target || progress.viewers.goal}`
    );
  } catch (e) {
    console.error("goal command youtube fetch failed:", e);
    ctx.reply("Couldn't reach YouTube for the goal numbers right now.");
  }
}

export async function uptimeHandler(ctx: CommandContext): Promise<void> {
  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("status, live_at, started_at")
    .eq("id", ctx.stream.id)
    .maybeSingle();
  const anchor =
    stream?.status === "live" ? (stream.live_at ?? stream.started_at) : null;
  if (!anchor) {
    ctx.reply("Not live yet — the show hasn't started.");
    return;
  }
  const totalMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(anchor).getTime()) / 60000)
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  ctx.reply(
    hours > 0 ? `Live for ${hours}h ${minutes}m` : `Live for ${minutes}m`
  );
}
