import { runClaude } from "./claude";
import type { EligibleStream } from "./streams";
import { deliverReply, enqueueNightbotSend } from "./replies";
import { supabaseAdmin } from "../supabase";

function intervalMs(env: string, fallback: number): number {
  const raw = Number(process.env[env]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const lastRun: Record<string, number> = {};

function due(key: string, interval: number): boolean {
  const now = Date.now();
  if (now - (lastRun[key] ?? 0) < interval) {
    return false;
  }
  lastRun[key] = now;
  return true;
}

export async function sendBroadcast(
  streamId: string,
  text: string
): Promise<void> {
  await deliverReply({ streamId, origin: "vidstube", text });
  enqueueNightbotSend(text);
}

type MomentSettings = {
  useful_info_enabled: boolean;
  competition_status_enabled: boolean;
  progress_update_enabled: boolean;
  wrapup_mvp_enabled: boolean;
  wrapup_summary_enabled: boolean;
  wrapup_thanks_enabled: boolean;
};

async function momentSettings(streamId: string): Promise<MomentSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("chat_scoring_state")
    .select(
      "useful_info_enabled, competition_status_enabled, progress_update_enabled, wrapup_mvp_enabled, wrapup_summary_enabled, wrapup_thanks_enabled"
    )
    .eq("stream_id", streamId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function topScorers(streamId: string, limit: number) {
  const { data } = await supabaseAdmin
    .from("viewer_scores")
    .select("author_name, user_id, total_score")
    .eq("stream_id", streamId)
    .order("total_score", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const named = await Promise.all(
    rows.map(async (r) => {
      let name = r.author_name?.replace(/^@+/, "") ?? null;
      if (!name && r.user_id) {
        const { data: ch } = await supabaseAdmin
          .from("channels")
          .select("handle")
          .eq("owner_user_id", r.user_id)
          .maybeSingle();
        name = ch?.handle ?? null;
      }
      return { name: name ?? "viewer", score: r.total_score };
    })
  );
  return named;
}

async function projectLines(channelId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("channel_projects")
    .select("name, blurb, domain_url, repo_url")
    .eq("channel_id", channelId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((p) => {
    const links = [p.domain_url, p.repo_url].filter(Boolean).join(" · ");
    return `${p.name}${p.blurb ? ` — ${p.blurb}` : ""}${links ? ` (${links})` : ""}`;
  });
}

async function recentTranscript(
  streamId: string,
  segments: number
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("transcript_segments")
    .select("text")
    .eq("stream_id", streamId)
    .order("start_s", { ascending: false })
    .limit(segments);
  return (data ?? [])
    .reverse()
    .map((s) => s.text)
    .join(" ");
}

export async function runProactiveMoments(
  stream: EligibleStream,
  channelId: string
): Promise<void> {
  const settings = await momentSettings(stream.id);
  if (!settings) {
    return;
  }

  if (
    settings.competition_status_enabled &&
    due(
      `competition:${stream.id}`,
      intervalMs("COMPETITION_STATUS_INTERVAL_MS", 600_000)
    )
  ) {
    const top = await topScorers(stream.id, 3);
    if (top.length) {
      const line = top
        .map((t, i) => `#${i + 1} ${t.name} (${t.score})`)
        .join(" · ");
      await sendBroadcast(stream.id, `Leaderboard check: ${line}`);
    }
  }

  if (
    settings.progress_update_enabled &&
    due(
      `progress:${stream.id}`,
      intervalMs("PROGRESS_UPDATE_INTERVAL_MS", 1_200_000)
    )
  ) {
    const lines = await projectLines(channelId);
    if (lines.length) {
      await sendBroadcast(
        stream.id,
        `Currently building: ${lines.join(" | ")}`
      );
    }
  }

  if (
    settings.useful_info_enabled &&
    due(
      `usefulinfo:${stream.id}`,
      intervalMs("USEFUL_INFO_INTERVAL_MS", 300_000)
    )
  ) {
    const transcript = await recentTranscript(stream.id, 8);
    if (transcript.trim()) {
      const prompt = [
        "You listen to a live streamer's recent words. If they wondered aloud about a specific factual question you can answer with high confidence (numbers, dates, definitions, conversions), answer it briefly. Otherwise return found=false. Never guess.",
        "",
        `Recent words: ${transcript.slice(-2000)}`,
        "",
        'Reply with JSON only: {"found": true|false, "answer": "<one short sentence or null>"}',
      ].join("\n");
      try {
        const raw = await runClaude(prompt);
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as {
            found?: boolean;
            answer?: string | null;
          };
          if (parsed.found === true && parsed.answer) {
            await sendBroadcast(
              stream.id,
              `Heard you wondering — ${parsed.answer}`.slice(0, 400)
            );
          }
        }
      } catch (e) {
        console.error("useful-info check failed:", e);
      }
    }
  }
}

export async function runWrapupIfRequested(
  stream: EligibleStream,
  channelId: string
): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from("streams")
    .select("wrapup_requested_at, wrapup_done_at")
    .eq("id", stream.id)
    .maybeSingle();
  if (error || !row?.wrapup_requested_at || row.wrapup_done_at) {
    return;
  }

  const { error: stampError } = await supabaseAdmin
    .from("streams")
    .update({ wrapup_done_at: new Date().toISOString() })
    .eq("id", stream.id)
    .is("wrapup_done_at", null);
  if (stampError) {
    console.error(stampError);
    return;
  }

  const settings = await momentSettings(stream.id);
  if (!settings) {
    return;
  }

  if (settings.wrapup_mvp_enabled) {
    const top = await topScorers(stream.id, 1);
    if (top.length) {
      await sendBroadcast(
        stream.id,
        `MVP of the stream: ${top[0].name} with ${top[0].score} points — massive thanks!`
      );
    }
  }

  if (settings.wrapup_summary_enabled) {
    const transcript = await recentTranscript(stream.id, 400);
    if (transcript.trim()) {
      try {
        const raw = await runClaude(
          [
            "Summarize what was achieved on this live stream as a single celebratory wrap-up chat message, under 380 characters, plain text.",
            "",
            `Transcript: ${transcript.slice(-8000)}`,
            "",
            "Reply with the message only.",
          ].join("\n")
        );
        const summary = raw.trim().slice(0, 400);
        if (summary) {
          await sendBroadcast(stream.id, summary);
        }
      } catch (e) {
        console.error("wrapup summary failed:", e);
      }
    }
  }

  if (settings.wrapup_thanks_enabled) {
    const lines = await projectLines(channelId);
    const projects = lines.length ? ` Keep up with the projects: ${lines.join(" | ")}` : "";
    await sendBroadcast(
      stream.id,
      `Thanks for watching, everyone!${projects}`.slice(0, 400)
    );
  }

  console.error("[wrapup] sent the enabled wrap-up messages");
}
