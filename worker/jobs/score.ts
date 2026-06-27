import { resolveAuthorIdentities } from "@/lib/author-identity";
import { runClaude } from "../lib/claude";
import {
  buildScoringPrompt,
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
} from "../lib/streams";
import { pollYoutubeChat, resolveLiveChatId } from "../lib/youtube-chat";
import { workerConfig } from "../config";
import { supabaseAdmin } from "../supabase";

const SCORE_INTERVAL_MS = 10_000;
const TRANSCRIPT_WINDOW_SEGMENTS = 40;

type BufferedMessage = {
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
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  if (!data?.length) {
    return [];
  }
  const identities = await resolveAuthorIdentities(
    supabaseAdmin,
    data.map((m) => m.user_id)
  );
  return data.map((m) => ({
    ref: `vidstube:${m.id}`,
    origin: "vidstube" as const,
    author: identities.get(m.user_id)?.handle ?? "viewer",
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

async function applyScoreResult(
  streamId: string,
  batch: BufferedMessage[],
  result: ScoreResult
): Promise<void> {
  const byRef = new Map(batch.map((m) => [m.ref, m]));

  type Participant = {
    sample: BufferedMessage;
    points: number;
    features: { m: BufferedMessage; score: number; categories: string[]; reason: string }[];
  };
  const participants = new Map<string, Participant>();

  function ensure(m: BufferedMessage): Participant {
    const k = participantKey(m);
    let p = participants.get(k);
    if (!p) {
      p = { sample: m, points: 0, features: [] };
      participants.set(k, p);
    }
    return p;
  }

  for (const s of result.scores) {
    const m = byRef.get(s.ref);
    if (!m) continue;
    ensure(m).points += pointsFor(s, m.origin);
  }
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
        score: f.score,
        categories: f.categories,
        reason: f.reason,
        ring_level: ring,
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
        metadata: { reasons: p.features.map((f) => f.reason) },
      });
    }
  }
}

export async function runScoringJob(stream: EligibleStream): Promise<void> {
  let vidstubeCursor = new Date().toISOString();

  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("youtube_video_id")
    .eq("id", stream.id)
    .maybeSingle();
  const youtubeVideoId = streamRow?.youtube_video_id ?? null;

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
      ytBuffer.push({
        ref: `youtube:${m.authorChannelId}:${m.publishedAt}`,
        origin: "youtube",
        author: m.author,
        text: m.text,
        userId: null,
        externalAuthorId: m.authorChannelId,
        authorName: m.author,
        authorAvatarUrl: m.avatarUrl,
        chatMessageId: null,
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

      const vid = await fetchNewVidstube(stream.id, vidstubeCursor);
      if (vid.length) {
        vidstubeCursor = vid[vid.length - 1].createdAt;
      }
      const yt = ytBuffer.splice(0, ytBuffer.length);
      const batch = [...vid, ...yt];

      if (batch.length) {
        const transcript = await fetchTranscriptWindow(stream.id);
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
          await applyScoreResult(stream.id, batch, parseScoreResult(raw));
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
