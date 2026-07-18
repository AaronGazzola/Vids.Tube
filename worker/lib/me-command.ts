import type { BufferedMessage } from "../jobs/score";
import type { CommandContext } from "./commands";

// Imported lazily so the pure helpers (regeneration rules, clipping) stay
// testable without worker env configured.
async function deps() {
  const [{ supabaseAdmin }, { runClaude }] = await Promise.all([
    import("../supabase"),
    import("./claude"),
  ]);
  return { supabaseAdmin, runClaude };
}

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
  const { supabaseAdmin } = await deps();
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
  const { supabaseAdmin } = await deps();
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
  current: MeStats,
  generatedAt: string | null = null,
  streamStartedAt: string | null = null
): boolean {
  if (!snapshot) {
    return true;
  }
  if (streamStartedAt) {
    const generated = generatedAt ? Date.parse(generatedAt) : NaN;
    if (!Number.isFinite(generated) || generated < Date.parse(streamStartedAt)) {
      return true;
    }
  }
  const prevMessages = snapshot.totalMessages ?? 0;
  const prevAttended = snapshot.videosAttended ?? 0;
  return (
    Math.abs(current.totalMessages - prevMessages) >= REGEN_MESSAGE_DELTA ||
    current.videosAttended !== prevAttended
  );
}

const MAX_SAMPLE_CHARS = 120;
const MAX_SAMPLES_PER_SOURCE = 8;

export function clipSample(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_SAMPLE_CHARS
    ? `${clean.slice(0, MAX_SAMPLE_CHARS - 1)}…`
    : clean;
}

export async function gatherRecentMessages(
  identity: MeIdentity
): Promise<string[]> {
  const { supabaseAdmin } = await deps();
  const filters: string[] = [];
  if (identity.userId) {
    filters.push(`user_id.eq.${identity.userId}`);
  }
  if (identity.youtubeChannelId) {
    filters.push(
      `and(origin.eq.youtube,external_author_id.eq.${identity.youtubeChannelId})`
    );
  }

  const samples: string[] = [];
  if (filters.length) {
    const { data } = await supabaseAdmin
      .from("chat_messages")
      .select("body")
      .or(filters.join(","))
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_SAMPLES_PER_SOURCE * 2);
    for (const row of data ?? []) {
      if (samples.length >= MAX_SAMPLES_PER_SOURCE) break;
      if (row.body.startsWith("!")) continue;
      samples.push(clipSample(row.body));
    }
  }

  if (identity.youtubeChannelId) {
    const { data } = await supabaseAdmin
      .from("youtube_chat_archive")
      .select("body")
      .eq("author_channel_id", identity.youtubeChannelId)
      .order("published_at", { ascending: false })
      .limit(MAX_SAMPLES_PER_SOURCE * 2);
    let added = 0;
    for (const row of data ?? []) {
      if (added >= MAX_SAMPLES_PER_SOURCE) break;
      if (row.body.startsWith("!")) continue;
      samples.push(clipSample(row.body));
      added += 1;
    }
  }

  return samples;
}

function hasHistory(stats: MeStats): boolean {
  return (
    stats.totalMessages > 0 ||
    stats.vidstubeScore > 0 ||
    stats.vidstubeStreams > 0
  );
}

function buildMePrompt(
  identity: MeIdentity,
  stats: MeStats,
  recentMessages: string[]
): string {
  const name = identity.displayName.replace(/^@+/, "");
  const lines = [
    `Viewer name: ${name}`,
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
  if (recentMessages.length) {
    lines.push(
      "Things they've said recently:",
      ...recentMessages.map((m) => `- ${m}`)
    );
  }
  return [
    "You write one-line chat-bot bios for live-stream viewers.",
    `Using only these facts, write a warm, playful mini-bio about ${name} in the third person (e.g. "${name} has been part of the community since…"), under 350 characters, plain text, no hashtags, no emojis at the start, no quotes around it.`,
    "If their recent messages suggest what they like to talk about, weave in one playful nod to it.",
    ...lines,
    "Reply with the bio text only.",
  ].join("\n");
}

export async function meHandler(ctx: CommandContext): Promise<void> {
  const { supabaseAdmin, runClaude } = await deps();
  const identity = await resolveMeIdentity(ctx.message);
  const stats = await gatherMeStats(identity);
  const mention = `@${identity.displayName.replace(/^@+/, "")}`;

  if (!hasHistory(stats)) {
    ctx.reply(`${mention} ${FIRST_TIMER_REPLY}`);
    return;
  }

  const { data: cached } = await supabaseAdmin
    .from("me_profiles")
    .select("profile, snapshot, generated_at")
    .eq("profile_key", identity.key)
    .maybeSingle();

  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("started_at, created_at")
    .eq("id", ctx.stream.id)
    .maybeSingle();
  const streamStartedAt =
    streamRow?.started_at ?? streamRow?.created_at ?? null;

  let profile = cached?.profile ?? null;
  if (
    !profile ||
    needsRegeneration(
      cached?.snapshot as Partial<MeStats> | null,
      stats,
      cached?.generated_at ?? null,
      streamStartedAt
    )
  ) {
    const recent = await gatherRecentMessages(identity);
    const raw = await runClaude(buildMePrompt(identity, stats, recent));
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
