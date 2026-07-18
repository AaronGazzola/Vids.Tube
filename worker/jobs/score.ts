import { resolveAuthorIdentities } from "@/lib/author-identity";
import { runClaude } from "../lib/claude";
import {
  buildScoringPrompt,
  type ModerationFlag,
  parseScoreResult,
  pointsFor,
  type ScoreResult,
  type ScoringMessage,
  type ScoringOrigin,
} from "../lib/scoring-prompt";
import {
  type EligibleStream,
  isStreamEligible,
  renewLock,
  upsertWorkerHeartbeat,
} from "../lib/streams";
import { processCommands } from "../lib/commands";
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
    engagement: number;
    humour: number;
    contribution: number;
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
      engagement: s.engagement,
      humour: s.humour,
      contribution: s.contribution,
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
        metadata: { reasons: p.features.map((f) => f.reason), items: p.items },
      });
    }
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

export async function runScoringJob(stream: EligibleStream): Promise<void> {
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
    for await (const m of pollYoutubeChat(liveChatId)) {
      if (stopped) {
        return;
      }
      const extMsgId = `${m.authorChannelId}:${m.publishedAt}`;
      let chatMessageId: string | null = null;
      const { data: row, error } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          stream_id: stream.id,
          origin: "youtube",
          external_author_id: m.authorChannelId,
          author_name: m.author,
          author_avatar_url: m.avatarUrl,
          external_message_id: extMsgId,
          body: m.text,
        })
        .select("id")
        .maybeSingle();
      if (error && error.code !== "23505") {
        console.error("persist youtube chat failed:", error.message);
      }
      chatMessageId = row?.id ?? null;
      console.error(`[chat:yt] ${m.author}: ${m.text}`);
      ytBuffer.push({
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
      const batch = channelId
        ? await processCommands(
            { id: stream.id, channelId, channelSlug },
            unmoderated
          )
        : unmoderated;

      if (batch.length) {
        const transcript = await fetchTranscriptWindow(stream.id);
        console.error(
          `[score] scoring ${batch.length} msg(s): ${vid.length} vidstube + ${yt.length} youtube` +
            (transcript ? ` (with ${transcript.length} chars transcript)` : " (no transcript)")
        );
        const prompt = buildScoringPrompt({
          transcript,
          messages: batch.map(toScoringMessage),
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
            const m = batch[Number(f.ref.replace(/^m/, ""))];
            console.error(
              `[score]   ★ featured (${f.score}) ${m ? `"${m.text.slice(0, 60)}"` : f.ref}${f.reason ? ` — ${f.reason}` : ""}`
            );
          }
          const settings = await fetchScoringSettings(stream.id);
          await applyScoreResult(stream.id, batch, result, settings);
          await applyModeration(
            stream.id,
            channelId,
            batch,
            result.moderation,
            settings.mode
          );
          await supabaseAdmin
            .from("chat_scoring_state")
            .update({ last_scored_at: new Date().toISOString() })
            .eq("stream_id", stream.id);
        }
      }

      if (!(await isStreamEligible(stream.id))) {
        break;
      }
      await sleep(SCORE_INTERVAL_MS);
    }
  } finally {
    stopped = true;
    await ytTask;
  }
}
