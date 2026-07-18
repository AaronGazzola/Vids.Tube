import type { CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

function clipParticipantKey(ctx: CommandContext): string {
  const m = ctx.message;
  return m.origin === "vidstube"
    ? String(m.userId)
    : `youtube:${m.externalAuthorId}`;
}

export function formatStreamTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export async function clipHandler(ctx: CommandContext): Promise<void> {
  const mention = `@${(ctx.message.authorName ?? ctx.message.author).replace(/^@+/, "")}`;

  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("live_at, started_at")
    .eq("id", ctx.stream.id)
    .maybeSingle();
  const anchor = stream?.live_at ?? stream?.started_at ?? null;
  const streamTimeS = anchor
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(anchor).getTime()) / 1000)
      )
    : 0;

  const { data: segments } = await supabaseAdmin
    .from("transcript_segments")
    .select("text")
    .eq("stream_id", ctx.stream.id)
    .order("start_s", { ascending: false })
    .limit(3);
  const snippet = (segments ?? [])
    .reverse()
    .map((s) => s.text)
    .join(" ")
    .trim();

  const { error } = await supabaseAdmin.from("clip_markers").insert({
    channel_id: ctx.stream.channelId,
    stream_id: ctx.stream.id,
    chat_message_id: ctx.message.chatMessageId,
    participant_key: clipParticipantKey(ctx),
    origin: ctx.message.origin === "vidstube" ? "vidstube" : "youtube",
    author_name: ctx.message.authorName ?? ctx.message.author,
    stream_time_s: streamTimeS,
    snippet: snippet || null,
  });
  if (error) {
    console.error("clip marker insert failed:", error);
    return;
  }

  ctx.reply(
    `${mention} clip marked at ${formatStreamTime(streamTimeS)} — it might become a YouTube short!`
  );
}
