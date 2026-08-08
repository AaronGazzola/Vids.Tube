import { ensureChatterChannel, refreshMembership } from "../lib/chatter-onboarding";
import {
  clearPendingGreetings,
  queuePendingGreeting,
  runChatterGreetings,
} from "../lib/chatter-greeting";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { SCORING_CONFIG } from "@/lib/scoring-config";
import { runClaude } from "../lib/claude";
import {
  buildHighlightScoringPrompt,
  buildScoringPrompt,
  type ModerationFlag,
  parseHighlightResult,
  parseScoreResult,
  pointsFor,
  type ScoreResult,
  type ScoringMessage,
  type ScoringOrigin,
} from "../lib/scoring-prompt";
import {
  type EligibleStream,
  getStreamEngagement,
  renewLock,
  resolveCommunityOwner,
  resolveEnrichmentMode,
  resolveHostChannelId,
  upsertWorkerHeartbeat,
} from "../lib/streams";
import { deliverApprovedAskAnswers } from "../lib/ask-command";
import { processCommands } from "../lib/commands";
import { consumeSelfEcho, enqueueNightbotBridge } from "../lib/replies";
import { runProactiveMoments, runWrapupIfRequested } from "../lib/moments";
import { synthesizePendingTts } from "../lib/tts";
import { processLinkVerifications } from "../lib/verify-links";
import { pollYoutubeChat, resolveLiveChatId } from "../lib/youtube-chat";
import { workerConfig } from "../config";
import { supabaseAdmin } from "../supabase";

const SCORE_INTERVAL_MS = 10_000;
const TRANSCRIPT_WINDOW_SEGMENTS = 40;

export type BufferedMessage = {
  ref: string;
  origin: ScoringOrigin;
  author: string;
  text: string;
  userId: string | null;
  externalAuthorId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  chatMessageId: string | null;
  createdAt: string;
  isHost?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function participantKey(m: BufferedMessage): string {
  return m.origin === "vidstube"
    ? String(m.userId)
    : `youtube:${m.externalAuthorId}`;
}

function toScoringMessage(m: BufferedMessage): ScoringMessage {
  return { ref: m.ref, origin: m.origin, author: m.author, text: m.text };
}

async function fetchNewVidstube(
  streamId: string,
  sinceIso: string
): Promise<BufferedMessage[]> {
  const { data } = await supabaseAdmin
    .from("chat_messages")
    .select("id, user_id, body, created_at")
    .eq("stream_id", streamId)
    .eq("origin", "vidstube")
    .is("hidden_at", null)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  if (!data?.length) {
    return [];
  }
  const identities = await resolveAuthorIdentities(
    supabaseAdmin,
    data.map((m) => m.user_id).filter((id): id is string => !!id)
  );
  return data.map((m) => ({
    ref: `vidstube:${m.id}`,
    origin: "vidstube" as const,
    author: (m.user_id ? identities.get(m.user_id)?.handle : null) ?? "viewer",
    text: m.body,
    userId: m.user_id,
    externalAuthorId: null,
    authorName: null,
    authorAvatarUrl: null,
    chatMessageId: m.id,
    createdAt: m.created_at,
  }));
}

async function fetchTranscriptWindow(streamId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("transcript_segments")
    .select("text, start_s")
    .eq("stream_id", streamId)
    .order("start_s", { ascending: false })
    .limit(TRANSCRIPT_WINDOW_SEGMENTS);
  if (!data?.length) {
    return "";
  }
  return data
    .slice()
    .reverse()
    .map((s) => s.text)
    .join(" ");
}

export type ScoringSettings = {
  mode: "manual" | "auto";
  highlighting: boolean;
  autoDisplay: boolean;
};

export async function applyScoreResult(
  streamId: string,
  batch: BufferedMessage[],
  result: ScoreResult,
  settings: ScoringSettings
): Promise<void> {
  const byRef = new Map<string, BufferedMessage>();
  batch.forEach((m, i) => {
    byRef.set(`m${i}`, m);
    byRef.set(String(i), m);
  });

  type BreakdownItem = {
    text: string;
    humour: number;
    insight: number;
    community: number;
    points: number;
  };
  type Participant = {
    sample: BufferedMessage;
    points: number;
    items: BreakdownItem[];
    features: { m: BufferedMessage; score: number; categories: string[]; reason: string }[];
  };
  const participants = new Map<string, Participant>();

  function ensure(m: BufferedMessage): Participant {
    const k = participantKey(m);
    let p = participants.get(k);
    if (!p) {
      p = { sample: m, points: 0, items: [], features: [] };
      participants.set(k, p);
    }
    return p;
  }

  for (const s of result.scores) {
    const m = byRef.get(s.ref);
    if (!m) continue;
    const points = pointsFor(s, m.origin);
    const p = ensure(m);
    p.points += points;
    p.items.push({
      text: m.text.slice(0, 200),
      humour: s.humour,
      insight: s.insight,
      community: s.community,
      points,
    });
  }
  // Featured highlighting can be switched off — when off, score/leaderboard still
  // run but no messages are featured (no overlay highlights, no "Read this").
  if (settings.highlighting) {
    for (const f of result.featured) {
      const m = byRef.get(f.ref);
      if (!m) continue;
      ensure(m).features.push({
        m,
        score: f.score,
        categories: f.categories,
        reason: f.reason,
      });
    }
  }

  const nowIso = new Date().toISOString();

  for (const [pkey, p] of participants) {
    const { data: existing } = await supabaseAdmin
      .from("viewer_scores")
      .select("total_score, features_count")
      .eq("stream_id", streamId)
      .eq("participant_key", pkey)
      .maybeSingle();

    const prevTotal = existing?.total_score ?? 0;
    const prevFeatures = existing?.features_count ?? 0;
    const newTotal = prevTotal + p.points;
    const newFeatures = prevFeatures + p.features.length;

    if (existing) {
      const update: {
        total_score: number;
        features_count: number;
        last_featured_at?: string;
      } = { total_score: newTotal, features_count: newFeatures };
      if (p.features.length) {
        update.last_featured_at = nowIso;
      }
      await supabaseAdmin
        .from("viewer_scores")
        .update(update)
        .eq("stream_id", streamId)
        .eq("participant_key", pkey);
    } else {
      await supabaseAdmin.from("viewer_scores").insert({
        stream_id: streamId,
        user_id: p.sample.userId,
        origin: p.sample.origin,
        external_author_id: p.sample.externalAuthorId,
        author_name: p.sample.authorName,
        author_avatar_url: p.sample.authorAvatarUrl,
        total_score: newTotal,
        features_count: newFeatures,
        last_featured_at: p.features.length ? nowIso : null,
      });
    }

    let ring = prevFeatures;
    for (const f of p.features) {
      ring += 1;
      await supabaseAdmin.from("featured_messages").insert({
        stream_id: streamId,
        chat_message_id: f.m.chatMessageId,
        user_id: f.m.userId,
        origin: f.m.origin,
        external_author_id: f.m.externalAuthorId,
        author_name: f.m.authorName,
        author_avatar_url: f.m.authorAvatarUrl,
        body: f.m.text,
        score: f.score,
        categories: f.categories,
        reason: f.reason,
        ring_level: ring,
        scored_at: nowIso,
        // Auto-display promotes featured messages straight to the overlay;
        // otherwise the owner promotes them manually with "Highlight".
        promoted_at: settings.autoDisplay ? nowIso : null,
      });
    }

    if (p.points !== 0 || p.features.length) {
      await supabaseAdmin.from("score_events").insert({
        stream_id: streamId,
        user_id: p.sample.userId,
        origin: p.sample.origin,
        external_author_id: p.sample.externalAuthorId,
        type: "score",
        points: p.points,
        scoring_version: SCORING_CONFIG.version,
        metadata: { reasons: p.features.map((f) => f.reason), items: p.items },
      });
    }
  }

  // Marks the batch as scored so a later manual highlight of one of these
  // messages doesn't award its author points a second time.
  const scoredIds = batch
    .map((m) => m.chatMessageId)
    .filter((id): id is string => !!id);
  if (scoredIds.length) {
    await supabaseAdmin
      .from("chat_messages")
      .update({ scored_at: nowIso })
      .in("id", scoredIds);
  }

  await refreshBatchMemberships(streamId, participants);
}

// Standing has to move while the broadcast is running, so every participant
// scored in this batch is recomputed now rather than by a script afterwards.
// This calls the same rebuild a full backfill uses, so live values and rebuilt
// values cannot disagree.
async function refreshBatchMemberships(
  streamId: string,
  participants: Map<string, { sample: BufferedMessage }>
): Promise<void> {
  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("channel_id")
    .eq("id", streamId)
    .maybeSingle();
  const communityId = streamRow?.channel_id;
  if (!communityId) return;

  const channelIds = new Set<string>();
  for (const [, p] of participants) {
    const s = p.sample;
    if (s.externalAuthorId) {
      const { data } = await supabaseAdmin
        .from("channels")
        .select("id, merged_into_channel_id")
        .eq("youtube_channel_id", s.externalAuthorId)
        .maybeSingle();
      const resolved = data?.merged_into_channel_id ?? data?.id;
      if (resolved) channelIds.add(resolved);
      continue;
    }
    if (s.userId) {
      const { data } = await supabaseAdmin
        .from("channels")
        .select("id")
        .eq("owner_user_id", s.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.id) channelIds.add(data.id);
    }
  }

  for (const channelId of channelIds) {
    if (channelId === communityId) continue;
    await refreshMembership(channelId, communityId);
  }
}

// Owner-picked highlights (three-dot menu → "Highlight on overlay") are created with
// no score. Each tick, score them with the AI and fold them into the competition
// exactly like an AI-featured message: feature count, ring level, score events, and —
// if the message was never batch-scored — leaderboard points.
export async function scoreManualHighlights(streamId: string): Promise<void> {
  const { data: pending } = await supabaseAdmin
    .from("featured_messages")
    .select(
      "id, chat_message_id, user_id, origin, external_author_id, author_name, author_avatar_url, body"
    )
    .eq("stream_id", streamId)
    .is("scored_at", null)
    .order("featured_at", { ascending: true })
    .limit(5);
  if (!pending?.length) {
    return;
  }

  const identities = await resolveAuthorIdentities(
    supabaseAdmin,
    pending.map((r) => r.user_id).filter((id): id is string => !!id)
  );
  const messages: ScoringMessage[] = pending.map((r, i) => {
    const origin: ScoringOrigin = r.origin === "youtube" ? "youtube" : "vidstube";
    return {
      ref: `m${i}`,
      origin,
      author:
        origin === "vidstube"
          ? (r.user_id ? identities.get(r.user_id)?.handle : null) ?? "viewer"
          : r.author_name ?? "viewer",
      text: r.body ?? "",
    };
  });

  const transcript = await fetchTranscriptWindow(streamId);
  console.error(`[score] scoring ${pending.length} manual highlight(s)`);
  let raw = "";
  try {
    raw = await runClaude(buildHighlightScoringPrompt({ transcript, messages }));
  } catch (e) {
    console.error("claude highlight scoring failed:", e);
    return;
  }
  if (!raw) {
    return;
  }
  const picks = parseHighlightResult(raw);
  const byRef = new Map(picks.map((p) => [p.ref, p]));
  const nowIso = new Date().toISOString();

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const pick = byRef.get(`m${i}`) ?? byRef.get(String(i));
    if (!pick) {
      continue;
    }
    const origin: ScoringOrigin =
      row.origin === "youtube" ? "youtube" : "vidstube";
    const pkey =
      origin === "vidstube"
        ? String(row.user_id)
        : `youtube:${row.external_author_id}`;

    let points = 0;
    if (row.chat_message_id) {
      const { data: msg } = await supabaseAdmin
        .from("chat_messages")
        .select("scored_at")
        .eq("id", row.chat_message_id)
        .maybeSingle();
      if (msg && !msg.scored_at) {
        points = pointsFor(pick, origin);
        await supabaseAdmin
          .from("chat_messages")
          .update({ scored_at: nowIso })
          .eq("id", row.chat_message_id);
      }
    }

    const { data: existing } = await supabaseAdmin
      .from("viewer_scores")
      .select("total_score, features_count")
      .eq("stream_id", streamId)
      .eq("participant_key", pkey)
      .maybeSingle();
    const prevFeatures = existing?.features_count ?? 0;

    if (existing) {
      await supabaseAdmin
        .from("viewer_scores")
        .update({
          total_score: (existing.total_score ?? 0) + points,
          features_count: prevFeatures + 1,
          last_featured_at: nowIso,
        })
        .eq("stream_id", streamId)
        .eq("participant_key", pkey);
    } else {
      await supabaseAdmin.from("viewer_scores").insert({
        stream_id: streamId,
        user_id: row.user_id,
        origin,
        external_author_id: row.external_author_id,
        author_name: row.author_name,
        author_avatar_url: row.author_avatar_url,
        total_score: points,
        features_count: 1,
        last_featured_at: nowIso,
      });
    }

    await supabaseAdmin
      .from("featured_messages")
      .update({
        score: pick.score,
        categories: pick.categories,
        reason: pick.reason,
        ring_level: prevFeatures + 1,
        scored_at: nowIso,
      })
      .eq("id", row.id);

    await supabaseAdmin.from("score_events").insert({
      stream_id: streamId,
      user_id: row.user_id,
      origin,
      external_author_id: row.external_author_id,
      type: "score",
      points,
      scoring_version: SCORING_CONFIG.version,
      metadata: {
        reasons: [pick.reason],
        items: points
          ? [
              {
                text: (row.body ?? "").slice(0, 200),
                humour: pick.humour,
                insight: pick.insight,
                community: pick.community,
                points,
              },
            ]
          : [],
      },
    });
    console.error(
      `[score]   ★ manual highlight scored (${pick.score}) "${(row.body ?? "").slice(0, 60)}"${pick.reason ? ` — ${pick.reason}` : ""}`
    );
  }
}

async function fetchBannedKeys(channelId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("banned_participants")
    .select("participant_key")
    .eq("channel_id", channelId);
  return new Set((data ?? []).map((r) => r.participant_key));
}

async function fetchScoringSettings(streamId: string): Promise<ScoringSettings> {
  const { data } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("moderation_mode, highlighting_enabled, auto_display_featured")
    .eq("stream_id", streamId)
    .maybeSingle();
  return {
    mode: data?.moderation_mode === "auto" ? "auto" : "manual",
    highlighting: data?.highlighting_enabled ?? true,
    autoDisplay: data?.auto_display_featured ?? false,
  };
}

export async function applyModeration(
  streamId: string,
  channelId: string | null,
  batch: BufferedMessage[],
  flags: ModerationFlag[],
  mode: "manual" | "auto"
): Promise<void> {
  if (!flags.length) return;
  const byRef = new Map<string, BufferedMessage>();
  batch.forEach((m, i) => {
    byRef.set(`m${i}`, m);
    byRef.set(String(i), m);
  });
  const nowIso = new Date().toISOString();

  for (const f of flags) {
    const m = byRef.get(f.ref);
    if (!m) continue;
    const pkey = participantKey(m);

    // Auto-hide is always on: a hide flag is always applied immediately. Bans
    // follow the ban-mode setting — auto-ban applies, suggest only records it.
    let applied = false;
    if (f.action === "hide") {
      if (m.chatMessageId) {
        await supabaseAdmin
          .from("chat_messages")
          .update({ hidden_at: nowIso, hidden_by: "ai" })
          .eq("id", m.chatMessageId);
        await supabaseAdmin
          .from("featured_messages")
          .delete()
          .eq("chat_message_id", m.chatMessageId);
      }
      applied = true;
    } else if (f.action === "ban" && mode === "auto" && channelId) {
      await supabaseAdmin.from("banned_participants").upsert(
        {
          channel_id: channelId,
          participant_key: pkey,
          origin: m.origin,
          user_id: m.userId,
          external_author_id: m.externalAuthorId,
          author_name: m.authorName,
          reason: f.reason,
          banned_by: "ai",
        },
        { onConflict: "channel_id,participant_key" }
      );
      if (m.chatMessageId) {
        await supabaseAdmin
          .from("chat_messages")
          .update({ hidden_at: nowIso, hidden_by: "ai" })
          .eq("id", m.chatMessageId);
      }
      applied = true;
    }

    await supabaseAdmin.from("moderation_actions").insert({
      stream_id: streamId,
      target_kind: f.action === "ban" ? "participant" : "message",
      action: f.action,
      chat_message_id: m.chatMessageId,
      participant_key: pkey,
      origin: m.origin,
      user_id: m.userId,
      external_author_id: m.externalAuthorId,
      author_name: m.authorName,
      reason: f.reason,
      source: "ai",
      status: applied ? "applied" : "suggested",
      decided_at: applied ? nowIso : null,
    });
  }
}

// The host and software channels never reach the queue at all. Bans do have to
// be checked here: greetings are queued during the chat poll, which runs before
// the batch is moderated. The owner's per-broadcast switch is read once per tick.
async function runGreetings(
  streamId: string,
  communityId: string,
  communitySlug: string,
  bannedKeys: Set<string>
): Promise<void> {
  if (!communitySlug) return;
  const { data: state } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("greet_returning")
    .eq("stream_id", streamId)
    .maybeSingle();
  try {
    await runChatterGreetings({
      streamId,
      communityId,
      communitySlug,
      greetReturning: state?.greet_returning ?? true,
      bannedKeys,
    });
  } catch (e) {
    console.error("chatter greetings failed:", e);
  }
}

export async function runScoringJob(
  stream: EligibleStream,
  onEngagement?: (fresh: EligibleStream) => void
): Promise<void> {
  let vidstubeCursor = new Date().toISOString();

  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("youtube_video_id, channel_id")
    .eq("id", stream.id)
    .maybeSingle();
  const youtubeVideoId = streamRow?.youtube_video_id ?? null;
  const channelId = streamRow?.channel_id ?? null;

  let channelSlug = "";
  if (channelId) {
    const { data: channelRow } = await supabaseAdmin
      .from("channels")
      .select("slug")
      .eq("id", channelId)
      .maybeSingle();
    channelSlug = channelRow?.slug ?? "";
  }

  const ytBuffer: BufferedMessage[] = [];
  let stopped = false;

  async function consumeYoutube(): Promise<void> {
    const liveChatId = await resolveLiveChatId(youtubeVideoId);
    if (!liveChatId) {
      return;
    }
    const enrichmentMode = channelId
      ? await resolveEnrichmentMode(channelId)
      : "full";
    const hostChannelId = await resolveHostChannelId(stream.id, channelId);
    const hostUserId = await resolveCommunityOwner(channelId);
    if (hostChannelId) {
      console.error(`[chat:yt] host recognised as ${hostChannelId}`);
    }
    const onboarded = new Set<string>();
    for await (const m of pollYoutubeChat(liveChatId)) {
      if (stopped) {
        return;
      }
      if (m.isBot && consumeSelfEcho(m.text)) {
        continue;
      }
      const extMsgId = m.id || `${m.authorChannelId}:${m.publishedAt}`;
      // The streamer chats from YouTube like anyone else, but is not a viewer of
      // their own broadcast. Attribute their messages to their account so chat
      // history is whole, then keep them out of scoring entirely.
      const isHost = !m.isBot && !!hostChannelId && m.authorChannelId === hostChannelId;
      let chatMessageId: string | null = null;
      const { data: row, error } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          stream_id: stream.id,
          origin: m.isBot ? "bot" : "youtube",
          user_id: isHost ? hostUserId : null,
          external_author_id: m.authorChannelId,
          author_name: m.author,
          author_avatar_url: m.avatarUrl,
          external_message_id: extMsgId,
          body: m.text,
        })
        .select("id")
        .maybeSingle();
      // A unique violation means a previous worker run already ingested and
      // processed this message (YouTube replays full history on reconnect) —
      // don't re-buffer it for scoring or commands.
      if (error?.code === "23505") {
        continue;
      }
      if (error) {
        console.error("persist youtube chat failed:", error.message);
      }
      chatMessageId = row?.id ?? null;
      console.error(`[chat:yt] ${m.author}: ${m.text}`);
      // Bot messages are visible in chat but never scored, moderated,
      // command-processed, or bridged back to YouTube.
      if (m.isBot) {
        continue;
      }
      // A chatter has to exist before their first message is scored, or the
      // batch has nothing to credit. The host is never onboarded: they own the
      // community rather than belonging to it.
      if (!isHost && channelId && !onboarded.has(m.authorChannelId)) {
        onboarded.add(m.authorChannelId);
        const result = await ensureChatterChannel({
          authorChannelId: m.authorChannelId,
          authorName: m.author,
          avatarUrl: m.avatarUrl,
          communityId: channelId,
          mode: enrichmentMode,
        });
        // Queued here rather than sent here: composing a welcome-back line can
        // need an AI call, and the chat poll must not stall behind it. The
        // dispatcher tick drains the queue, which is also what lets it see how
        // many are waiting and decide between individual and combined greetings.
        if (result && !result.isSoftware) {
          queuePendingGreeting(stream.id, {
            channelId: result.channelId,
            handle: result.awaitingEnrichment ? null : result.handle,
            displayName: m.author,
            isNew: result.isNew,
            sample: {
              ref: `youtube:${m.authorChannelId}:${m.publishedAt}`,
              origin: "youtube",
              author: m.author,
              text: m.text,
              userId: null,
              externalAuthorId: m.authorChannelId,
              authorName: m.author,
              authorAvatarUrl: m.avatarUrl,
              chatMessageId,
              createdAt: m.publishedAt,
              isHost: false,
            },
          });
        }
      }
      // Host messages are buffered so their commands still dispatch — the
      // streamer runs commands from YouTube chat — but are dropped before the
      // batch reaches the scorer.
      ytBuffer.push({
        ref: `youtube:${m.authorChannelId}:${m.publishedAt}`,
        origin: "youtube",
        author: m.author,
        text: m.text,
        userId: isHost ? hostUserId : null,
        externalAuthorId: m.authorChannelId,
        authorName: m.author,
        authorAvatarUrl: m.avatarUrl,
        chatMessageId,
        createdAt: m.publishedAt,
        isHost,
      });
    }
  }

  const ytTask = youtubeVideoId
    ? consumeYoutube().catch((e) => console.error("youtube chat error:", e))
    : Promise.resolve();

  try {
    for (;;) {
      await renewLock(stream.id, workerConfig.loop.lockLeaseMs);
      // The dispatcher tick blocks for the whole engagement, so the heartbeat
      // must be renewed from inside the loop or it goes stale mid-broadcast.
      await upsertWorkerHeartbeat();

      const vid = await fetchNewVidstube(stream.id, vidstubeCursor);
      if (vid.length) {
        vidstubeCursor = vid[vid.length - 1].createdAt;
      }
      const yt = ytBuffer.splice(0, ytBuffer.length);
      const bannedKeys = channelId
        ? await fetchBannedKeys(channelId)
        : new Set<string>();
      const unmoderated = [...vid, ...yt].filter(
        (m) => !bannedKeys.has(participantKey(m))
      );
      await processLinkVerifications(unmoderated);
      await synthesizePendingTts(stream.id);
      await deliverApprovedAskAnswers(stream.id);
      await scoreManualHighlights(stream.id);
      if (channelId) {
        await runGreetings(stream.id, channelId, channelSlug, bannedKeys);
        await runProactiveMoments(stream, channelId);
        await runWrapupIfRequested(stream, channelId);
      }
      let batch = unmoderated;
      if (channelId) {
        const { data: prefs } = await supabaseAdmin
          .from("streams")
          .select("disabled_commands")
          .eq("id", stream.id)
          .maybeSingle();
        batch = await processCommands(
          {
            id: stream.id,
            channelId,
            channelSlug,
            disabledCommands: prefs?.disabled_commands ?? [],
          },
          unmoderated
        );
      }

      if (youtubeVideoId) {
        const { data: bridgeState } = await supabaseAdmin
          .from("chat_scoring_state")
          .select("bridge_enabled")
          .eq("stream_id", stream.id)
          .maybeSingle();
        if (bridgeState?.bridge_enabled !== false) {
          for (const m of batch) {
            if (m.origin === "vidstube") {
              enqueueNightbotBridge(`${m.authorName ?? m.author}: ${m.text}`);
            }
          }
        }
      }

      // Commands have dispatched by now, so the host drops out here: present in
      // chat and in replay, never scored, never on a leaderboard.
      const scorable = batch.filter((m) => !m.isHost);
      if (scorable.length) {
        const transcript = await fetchTranscriptWindow(stream.id);
        console.error(
          `[score] scoring ${scorable.length} msg(s): ${vid.length} vidstube + ${yt.length} youtube` +
            (transcript ? ` (with ${transcript.length} chars transcript)` : " (no transcript)")
        );
        const prompt = buildScoringPrompt({
          transcript,
          messages: scorable.map(toScoringMessage),
        });
        let raw = "";
        try {
          raw = await runClaude(prompt);
        } catch (e) {
          console.error("claude scoring failed:", e);
        }
        if (raw) {
          const result = parseScoreResult(raw);
          console.error(
            `[score] result: ${result.scores.length} scored, ${result.featured.length} featured, ${result.moderation.length} flagged`
          );
          for (const f of result.featured) {
            const m = scorable[Number(f.ref.replace(/^m/, ""))];
            console.error(
              `[score]   ★ featured (${f.score}) ${m ? `"${m.text.slice(0, 60)}"` : f.ref}${f.reason ? ` — ${f.reason}` : ""}`
            );
          }
          const settings = await fetchScoringSettings(stream.id);
          await applyScoreResult(stream.id, scorable, result, settings);
          await applyModeration(
            stream.id,
            channelId,
            scorable,
            result.moderation,
            settings.mode
          );
          await supabaseAdmin
            .from("chat_scoring_state")
            .update({ last_scored_at: new Date().toISOString() })
            .eq("stream_id", stream.id);
        }
      }

      const fresh = await getStreamEngagement(stream.id);
      if (!fresh) {
        break;
      }
      onEngagement?.(fresh);
      await sleep(SCORE_INTERVAL_MS);
    }
  } finally {
    stopped = true;
    await ytTask;
    // Anyone still queued when the broadcast ends is dropped rather than greeted
    // into an empty chat; who was already greeted is recorded in the database.
    clearPendingGreetings(stream.id);
  }
}
