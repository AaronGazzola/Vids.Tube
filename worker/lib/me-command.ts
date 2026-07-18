import type { BufferedMessage } from "../jobs/score";
import { runClaude } from "./claude";
import type { CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

const REGEN_MESSAGE_DELTA = 20;
const MAX_PROFILE_CHARS = 400;

export const FIRST_TIMER_REPLY =
  "you're brand new here — welcome in! Stick around, chat a bit, and I'll have a story about you next time.";

export type MeIdentity = {
  key: string;
  displayName: string;
  youtubeChannelId: string | null;
  userId: string | null;
};

export type MeStats = {
  totalMessages: number;
  videosAttended: number;
  firstSeenAt: string | null;
  vidstubeScore: number;
  vidstubeFeatures: number;
  vidstubeStreams: number;
};

export function truncateProfile(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_PROFILE_CHARS) {
    return clean;
  }
  const slice = clean.slice(0, MAX_PROFILE_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut =
    lastSpace > MAX_PROFILE_CHARS / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

export async function resolveMeIdentity(
  m: BufferedMessage
): Promise<MeIdentity> {
  if (m.origin === "youtube" && m.externalAuthorId) {
    return {
      key: `youtube:${m.externalAuthorId}`,
      displayName: m.authorName ?? m.author,
      youtubeChannelId: m.externalAuthorId,
      userId: null,
    };
  }
  const userId = m.userId;
  let youtubeChannelId: string | null = null;
  if (userId) {
    const { data } = await supabaseAdmin
      .from("youtube_links")
      .select("youtube_channel_id, verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.verified_at) {
      youtubeChannelId = data.youtube_channel_id;
    }
  }
  return {
    key: youtubeChannelId ? `youtube:${youtubeChannelId}` : `user:${userId}`,
    displayName: m.author,
    youtubeChannelId,
    userId,
  };
}

export async function gatherMeStats(identity: MeIdentity): Promise<MeStats> {
  let totalMessages = 0;
  let videosAttended = 0;
  let firstSeenAt: string | null = null;

  if (identity.youtubeChannelId) {
    const { data } = await supabaseAdmin
      .from("chatter_stats")
      .select("total_messages, videos_attended, first_seen_at")
      .eq("author_channel_id", identity.youtubeChannelId)
      .maybeSingle();
    if (data) {
      totalMessages += data.total_messages;
      videosAttended += data.videos_attended;
      firstSeenAt = data.first_seen_at;
    }
  }

  let vidstubeScore = 0;
  let vidstubeFeatures = 0;
  let vidstubeStreams = 0;
  if (identity.userId) {
    const { data } = await supabaseAdmin
      .from("viewer_scores")
      .select("total_score, features_count, stream_id")
      .eq("user_id", identity.userId);
    for (const row of data ?? []) {
      vidstubeScore += row.total_score;
      vidstubeFeatures += row.features_count;
      vidstubeStreams += 1;
    }
    videosAttended += vidstubeStreams;
  }

  return {
    totalMessages,
    videosAttended,
    firstSeenAt,
    vidstubeScore,
    vidstubeFeatures,
    vidstubeStreams,
  };
}

export function needsRegeneration(
  snapshot: Partial<MeStats> | null,
  current: MeStats
): boolean {
  if (!snapshot) {
    return true;
  }
  const prevMessages = snapshot.totalMessages ?? 0;
  const prevAttended = snapshot.videosAttended ?? 0;
  return (
    Math.abs(current.totalMessages - prevMessages) >= REGEN_MESSAGE_DELTA ||
    current.videosAttended !== prevAttended
  );
}

function hasHistory(stats: MeStats): boolean {
  return (
    stats.totalMessages > 0 ||
    stats.vidstubeScore > 0 ||
    stats.vidstubeStreams > 0
  );
}

function buildMePrompt(identity: MeIdentity, stats: MeStats): string {
  const lines = [
    `Viewer name: ${identity.displayName}`,
    `Messages in the channel's YouTube chat history: ${stats.totalMessages}`,
    `Streams/videos attended: ${stats.videosAttended}`,
  ];
  if (stats.firstSeenAt) {
    lines.push(`First seen: ${stats.firstSeenAt.slice(0, 10)}`);
  }
  if (stats.vidstubeStreams > 0) {
    lines.push(
      `Vids.Tube activity: ${stats.vidstubeScore} points across ${stats.vidstubeStreams} stream(s), featured ${stats.vidstubeFeatures}x`
    );
  }
  return [
    "You write one-line chat-bot bios for live-stream viewers.",
    "Using only these facts, write a warm, playful mini-bio in the second person, under 350 characters, plain text, no hashtags, no emojis at the start, no quotes around it:",
    ...lines,
    "Reply with the bio text only.",
  ].join("\n");
}

export async function meHandler(ctx: CommandContext): Promise<void> {
  const identity = await resolveMeIdentity(ctx.message);
  const stats = await gatherMeStats(identity);
  const mention = `@${identity.displayName.replace(/^@+/, "")}`;

  if (!hasHistory(stats)) {
    ctx.reply(`${mention} ${FIRST_TIMER_REPLY}`);
    return;
  }

  const { data: cached } = await supabaseAdmin
    .from("me_profiles")
    .select("profile, snapshot")
    .eq("profile_key", identity.key)
    .maybeSingle();

  let profile = cached?.profile ?? null;
  if (
    !profile ||
    needsRegeneration(cached?.snapshot as Partial<MeStats> | null, stats)
  ) {
    const raw = await runClaude(buildMePrompt(identity, stats));
    profile = truncateProfile(raw);
    const { error } = await supabaseAdmin.from("me_profiles").upsert(
      {
        profile_key: identity.key,
        profile,
        snapshot: stats as unknown as Record<string, number>,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "profile_key" }
    );
    if (error) {
      console.error("me profile cache write failed:", error);
    }
  }

  ctx.reply(truncateProfile(`${mention} ${profile}`));
}
