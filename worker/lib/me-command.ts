import { summariseChat, type ChatRow } from "@/lib/chatter-stats";
import type { BufferedMessage } from "../jobs/score";
import { memberLink, siteLabel } from "./chatter-greeting";
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
const MAX_PROFILE_CHARS = 600;
// The welcome-back greeting carries a mention and a link inside YouTube's
// 200-character limit, so the short line has to leave room for both.
const MAX_SHORT_CHARS = 110;

export const FIRST_TIMER_REPLY =
  "you're brand new here — welcome in! Stick around, chat a bit, and I'll have a story about you next time.";

export type MeIdentity = {
  key: string;
  displayName: string;
  youtubeChannelId: string | null;
  userId: string | null;
  isHost: boolean;
  communityChannelId: string | null;
};

export type HostStats = {
  members: number;
  messagesThisStream: number;
  streamsToDate: number;
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
  m: BufferedMessage,
  communityChannelId: string | null = null
): Promise<MeIdentity> {
  const { supabaseAdmin } = await deps();
  if (m.origin === "youtube" && m.externalAuthorId) {
    return {
      key: `youtube:${m.externalAuthorId}`,
      displayName: m.authorName ?? m.author,
      youtubeChannelId: m.externalAuthorId,
      userId: m.userId,
      isHost: !!m.isHost,
      communityChannelId,
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
    isHost: !!m.isHost,
    communityChannelId,
  };
}

// The host's reply is about the community, not about them: they have no rank to
// hold, no level to reach and no streak to keep in their own channel.
export async function gatherHostStats(
  communityChannelId: string,
  streamId: string
): Promise<HostStats> {
  const { supabaseAdmin } = await deps();
  const { count: members } = await supabaseAdmin
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("community_channel_id", communityChannelId);
  const { count: messagesThisStream } = await supabaseAdmin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", streamId);
  const { count: streamsToDate } = await supabaseAdmin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", communityChannelId)
    .eq("status", "ended");
  return {
    members: members ?? 0,
    messagesThisStream: messagesThisStream ?? 0,
    streamsToDate: streamsToDate ?? 0,
  };
}

export function buildHostReply(name: string, stats: HostStats): string {
  const mention = `@${name.replace(/^@+/, "")}`;
  return `${mention} this is your channel — ${stats.members} member${stats.members === 1 ? "" : "s"} across ${stats.streamsToDate} stream${stats.streamsToDate === 1 ? "" : "s"}, ${stats.messagesThisStream} message${stats.messagesThisStream === 1 ? "" : "s"} in chat today.`;
}

export async function gatherMeStats(identity: MeIdentity): Promise<MeStats> {
  const { supabaseAdmin } = await deps();

  // One query, one source. The old path added a pre-aggregated summary of the
  // YouTube archive to a watermarked count of stored chat, which double-counted
  // the moment an identity was linked and the merge attached the user id to rows
  // the summary had already counted.
  const rows: ChatRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from("chat_messages")
      .select("stream_id, created_at, user_id, external_author_id")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (identity.userId && identity.youtubeChannelId) {
      q = q.or(
        `user_id.eq.${identity.userId},external_author_id.eq.${identity.youtubeChannelId}`
      );
    } else if (identity.userId) {
      q = q.eq("user_id", identity.userId);
    } else if (identity.youtubeChannelId) {
      q = q.eq("external_author_id", identity.youtubeChannelId);
    } else {
      break;
    }
    const { data, error } = await q;
    if (error) {
      console.error("chatter stats read failed:", error.message);
      break;
    }
    rows.push(
      ...(data ?? []).map((m) => ({
        streamId: m.stream_id,
        createdAt: m.created_at,
        userId: m.user_id,
        externalAuthorId: m.external_author_id,
      }))
    );
    if ((data ?? []).length < PAGE) break;
  }

  const totals = summariseChat(rows, {
    userId: identity.userId,
    youtubeChannelId: identity.youtubeChannelId,
  });
  const totalMessages = totals.totalMessages;
  const videosAttended = totals.videosAttended;
  const firstSeenAt = totals.firstSeenAt;

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

async function unclaimedClaimNudge(
  identity: MeIdentity,
  communitySlug: string
): Promise<string> {
  // Never prompt the host to claim a profile: the only one matching their
  // account would be a duplicate of their own community.
  if (identity.isHost || !identity.youtubeChannelId) {
    return "";
  }
  const { supabaseAdmin } = await deps();
  const { data } = await supabaseAdmin
    .from("channels")
    .select("handle, owner_user_id, awaiting_enrichment")
    .eq("youtube_channel_id", identity.youtubeChannelId)
    .maybeSingle();
  if (!data || data.owner_user_id) {
    return "";
  }
  // A handle still awaiting enrichment is about to be rewritten, so linking to
  // it would publish an address that stops resolving.
  if (data.awaiting_enrichment) {
    return ` · your page's already here — ${siteLabel()} — sign in there to claim it`;
  }
  // The scheme is what makes YouTube render this as a link.
  return ` · your page: ${memberLink(data.handle, communitySlug)}`;
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
    "You write chat-bot copy about live-stream viewers.",
    `Using only these facts, write two things about ${name}:`,
    `BIO: a warm, playful mini-bio in the third person (e.g. "${name} has been part of the community since…"), under ~550 characters. If their recent messages suggest what they like to talk about, weave in one playful nod to it.`,
    `WELCOME: a single welcome-back line addressed to ${name} in the second person, under ${MAX_SHORT_CHARS} characters, referring to something they have actually said or done here. No greeting word at the start (the bot adds "welcome back" itself), no link, no mention handle.`,
    "Both plain text, no hashtags, no emojis, no quotes around them.",
    ...lines,
    "Reply with exactly two lines, the first starting with BIO: and the second starting with WELCOME:.",
  ].join("\n");
}

// Claude is asked for two labelled lines. If the labels are missing, the whole
// reply is the bio and the caller falls back to a stats line for the greeting,
// rather than publishing a half-parsed sentence.
export function parseProfileResponse(raw: string): {
  profile: string;
  shortLine: string | null;
} {
  const bioMatch = raw.match(/^\s*BIO:\s*(.+?)\s*$/im);
  const welcomeMatch = raw.match(/^\s*WELCOME:\s*(.+?)\s*$/im);
  if (!bioMatch) {
    return { profile: truncateProfile(raw), shortLine: null };
  }
  const shortRaw = welcomeMatch?.[1]?.trim() ?? "";
  return {
    profile: truncateProfile(bioMatch[1]),
    shortLine: shortRaw ? clipShortLine(shortRaw) : null,
  };
}

export function clipShortLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
  if (clean.length <= MAX_SHORT_CHARS) return clean;
  const slice = clean.slice(0, MAX_SHORT_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > MAX_SHORT_CHARS / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

// One cache, one regeneration rule, two consumers: the !me reply and the
// welcome-back greeting. Sharing this is what stops the two describing the same
// person differently in the same broadcast.
export async function ensureMeProfile(
  identity: MeIdentity,
  streamId: string,
  stats: MeStats
): Promise<{ profile: string; shortLine: string | null }> {
  const { supabaseAdmin, runClaude } = await deps();

  const { data: cached } = await supabaseAdmin
    .from("me_profiles")
    .select("profile, short_line, snapshot, generated_at")
    .eq("profile_key", identity.key)
    .maybeSingle();

  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("started_at, created_at")
    .eq("id", streamId)
    .maybeSingle();
  const streamStartedAt =
    streamRow?.started_at ?? streamRow?.created_at ?? null;

  const stale =
    !cached?.profile ||
    needsRegeneration(
      cached?.snapshot as Partial<MeStats> | null,
      stats,
      cached?.generated_at ?? null,
      streamStartedAt
    );

  if (!stale && cached?.profile) {
    return { profile: cached.profile, shortLine: cached.short_line };
  }

  const recent = await gatherRecentMessages(identity);
  const raw = await runClaude(buildMePrompt(identity, stats, recent));
  const parsed = parseProfileResponse(raw);

  const { error } = await supabaseAdmin.from("me_profiles").upsert(
    {
      profile_key: identity.key,
      profile: parsed.profile,
      short_line: parsed.shortLine,
      snapshot: stats as unknown as Record<string, number>,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "profile_key" }
  );
  if (error) {
    console.error("me profile cache write failed:", error);
  }

  return parsed;
}

export async function meHandler(ctx: CommandContext): Promise<void> {
  const identity = await resolveMeIdentity(ctx.message, ctx.stream.channelId);

  if (identity.isHost && identity.communityChannelId) {
    const hostStats = await gatherHostStats(
      identity.communityChannelId,
      ctx.stream.id
    );
    ctx.reply(buildHostReply(identity.displayName, hostStats));
    return;
  }

  const stats = await gatherMeStats(identity);
  const mention = `@${identity.displayName.replace(/^@+/, "")}`;

  if (!hasHistory(stats)) {
    ctx.reply(`${mention} ${FIRST_TIMER_REPLY}`);
    return;
  }

  const { profile } = await ensureMeProfile(identity, ctx.stream.id, stats);
  const nudge = await unclaimedClaimNudge(identity, ctx.stream.channelSlug);
  ctx.reply(truncateProfile(`${mention} ${profile}`) + nudge);
}
