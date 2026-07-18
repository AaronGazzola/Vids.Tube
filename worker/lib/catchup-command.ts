import { runClaude } from "./claude";
import type { CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

const CACHE_TTL_MS = 180_000;
const MAX_SUMMARY_CHARS = 400;

let cache: { streamId: string; text: string; generatedAt: number } | null =
  null;

function truncateSummary(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_SUMMARY_CHARS) {
    return clean;
  }
  const slice = clean.slice(0, MAX_SUMMARY_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 200 ? slice.slice(0, lastSpace) : slice}…`;
}

export async function catchupHandler(ctx: CommandContext): Promise<void> {
  if (
    cache &&
    cache.streamId === ctx.stream.id &&
    Date.now() - cache.generatedAt < CACHE_TTL_MS
  ) {
    ctx.reply(cache.text);
    return;
  }

  const { data: segments, error } = await supabaseAdmin
    .from("transcript_segments")
    .select("text")
    .eq("stream_id", ctx.stream.id)
    .order("start_s", { ascending: true })
    .limit(400);
  if (error) {
    console.error(error);
    return;
  }
  const transcript = (segments ?? []).map((s) => s.text).join(" ");
  if (!transcript.trim()) {
    ctx.reply("Nothing to catch up on yet — the stream is just getting going!");
    return;
  }

  const prompt = [
    "Summarize what has happened on this live stream so far for a viewer who just arrived.",
    "Friendly, energetic, under 380 characters, plain text, no hashtags.",
    "",
    `Transcript so far: ${transcript.slice(-8000)}`,
    "",
    "Reply with the summary only.",
  ].join("\n");
  const raw = await runClaude(prompt);
  const summary = truncateSummary(raw);
  cache = { streamId: ctx.stream.id, text: summary, generatedAt: Date.now() };
  console.error("[catchup] generated a fresh summary");
  ctx.reply(summary);
}
