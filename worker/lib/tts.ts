import { runClaude } from "./claude";
import type { CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

const MAX_TTS_CHARS = 200;
const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

let warnedMissingKey = false;

export type TtsVerdict = { allow: boolean; reason: string };

export async function moderateTtsText(text: string): Promise<TtsVerdict> {
  const prompt = [
    "You moderate viewer messages before they are spoken aloud by a TTS voice on a live stream.",
    "Block anything with insults, slurs, harassment, sexual content, doxxing/personal info, spam, links, scams, or political/religious flamebait. Friendly banter, jokes, questions, and compliments are fine.",
    `Message: "${text.replace(/"/g, "'")}"`,
    'Reply with JSON only: {"allow": true|false, "reason": "<one short sentence>"}',
  ].join("\n");
  const raw = await runClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { allow: false, reason: "Moderation returned no verdict" };
  }
  try {
    const parsed = JSON.parse(match[0]) as Partial<TtsVerdict>;
    return {
      allow: parsed.allow === true,
      reason: String(parsed.reason ?? ""),
    };
  } catch {
    return { allow: false, reason: "Moderation verdict unparseable" };
  }
}

function ttsParticipantKey(ctx: CommandContext): string {
  const m = ctx.message;
  return m.origin === "vidstube"
    ? String(m.userId)
    : `youtube:${m.externalAuthorId}`;
}

export async function ttsHandler(ctx: CommandContext): Promise<void> {
  const text = ctx.args.trim();
  const mention = `@${(ctx.message.authorName ?? ctx.message.author).replace(/^@+/, "")}`;
  if (!text) {
    ctx.reply(`${mention} usage: !tts your message (max ${MAX_TTS_CHARS} characters)`);
    return;
  }
  if (text.length > MAX_TTS_CHARS) {
    ctx.reply(
      `${mention} that's ${text.length} characters — TTS messages max out at ${MAX_TTS_CHARS}.`
    );
    return;
  }

  const verdict = await moderateTtsText(text);

  const { data: scoring } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("tts_mode")
    .eq("stream_id", ctx.stream.id)
    .maybeSingle();
  const auto = scoring?.tts_mode === "auto";

  const status = !verdict.allow ? "dismissed" : auto ? "approved" : "suggested";
  const { error } = await supabaseAdmin.from("tts_requests").insert({
    channel_id: ctx.stream.channelId,
    stream_id: ctx.stream.id,
    chat_message_id: ctx.message.chatMessageId,
    participant_key: ttsParticipantKey(ctx),
    origin: ctx.message.origin === "vidstube" ? "vidstube" : "youtube",
    author_name: ctx.message.authorName ?? ctx.message.author,
    text,
    status,
    reason: verdict.reason || null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("tts request insert failed:", error);
    return;
  }

  if (status === "approved") {
    ctx.reply(`${mention} queued — your message will be spoken on stream.`);
  } else if (status === "suggested") {
    ctx.reply(`${mention} sent to the streamer for approval.`);
  }
}

type FetchLike = typeof fetch;

export async function synthesizeTts(
  text: string,
  fetchImpl: FetchLike = fetch
): Promise<ArrayBuffer | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.error("ELEVENLABS_API_KEY is not set — TTS synthesis is skipped");
    }
    return null;
  }
  const voice = process.env.ELEVENLABS_VOICE_ID ?? ELEVENLABS_DEFAULT_VOICE;
  const res = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
      }),
    }
  );
  if (!res.ok) {
    console.error(`elevenlabs synthesis failed (${res.status}): ${await res.text()}`);
    return null;
  }
  return res.arrayBuffer();
}

// Runs once per scoring pass: any approved request without audio gets its mp3.
export async function synthesizePendingTts(streamId: string): Promise<void> {
  const { data: pending, error } = await supabaseAdmin
    .from("tts_requests")
    .select("id, text")
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .is("audio_path", null)
    .order("approved_at", { ascending: true })
    .limit(5);
  if (error) {
    console.error(error);
    return;
  }
  for (const row of pending ?? []) {
    const audio = await synthesizeTts(row.text);
    if (!audio) {
      return;
    }
    const path = `${row.id}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("tts")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) {
      console.error("tts upload failed:", uploadError);
      continue;
    }
    const { error: updateError } = await supabaseAdmin
      .from("tts_requests")
      .update({ audio_path: path })
      .eq("id", row.id);
    if (updateError) {
      console.error(updateError);
    } else {
      console.error(`[tts] synthesized "${row.text.slice(0, 40)}" -> ${path}`);
    }
  }
}
