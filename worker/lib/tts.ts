import { runClaude } from "./claude";
import { commandParticipantKey, type CommandContext } from "./commands";
import { supabaseAdmin } from "../supabase";

const MAX_TTS_CHARS = 200;
const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

// The catalog a chatter picks from. Keys are what chatters type (matched
// case-insensitively) and what is stored on the request row; the ElevenLabs id
// is never accepted from chat, so the input is a closed enum.
export const TTS_VOICES: Record<string, string> = {
  old: "MKlLqCItoCkvdhrxgtLv",
  evil: "Vs5CmVCVJwW4odQS2pVf",
  Victoria: "qSeXEcewz7tA0Q0qk9fH",
  Oliver: "L1aJrPa7pLJEyYlh3Ilq",
  DJ: "mKoqwDP2laxTdq1gEgU6",
};

export function resolveVoiceName(token: string): string | null {
  const lowered = token.toLowerCase();
  return (
    Object.keys(TTS_VOICES).find((name) => name.toLowerCase() === lowered) ??
    null
  );
}

// The leading token is stripped only when it names a known voice, so an
// unmatched first word stays in the text and is still moderated.
export function splitVoiceToken(args: string): {
  voice: string | null;
  text: string;
} {
  const trimmed = args.trim();
  const [first, ...rest] = trimmed.split(/\s+/);
  const voice = first ? resolveVoiceName(first) : null;
  return voice
    ? { voice, text: rest.join(" ") }
    : { voice: null, text: trimmed };
}

// A chatter who has never picked still gets a voice of their own, so the stream
// sounds varied with zero chatter effort. Seeded from the lowest identity key so
// the linked YouTube and Vids.Tube identities land on the same voice.
export function seedVoice(keys: string[]): string {
  const names = Object.keys(TTS_VOICES);
  const seed = [...keys].sort()[0] ?? "";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return names[hash % names.length];
}

export type TtsVoiceSettings = { stability: number; similarity: number };

export const DEFAULT_TTS_VOICE: TtsVoiceSettings = {
  stability: 0.5,
  similarity: 0.75,
};

// Short unpunctuated inputs make flash v2.5 drag the final syllable
// ("three" -> "threeeee"); a terminal full stop anchors the prosody.
export function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

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

// One person can hold two keys: a Vids.Tube account and a YouTube channel. Both
// are returned; the first is the one this request is filed under, the rest are
// read alongside it. The account key is filed under whenever the message carries
// an account, which is what keeps the host's voice sticky across both chats.
async function identityKeys(ctx: CommandContext): Promise<string[]> {
  const m = ctx.message;
  const key = commandParticipantKey(m);
  if (!m.userId) {
    const { data } = await supabaseAdmin
      .from("youtube_links")
      .select("user_id, verified_at")
      .eq("youtube_channel_id", String(m.externalAuthorId))
      .maybeSingle();
    return data?.verified_at ? [key, data.user_id] : [key];
  }
  if (m.externalAuthorId) {
    return [key, `youtube:${m.externalAuthorId}`];
  }
  const { data } = await supabaseAdmin
    .from("youtube_links")
    .select("youtube_channel_id, verified_at")
    .eq("user_id", m.userId)
    .maybeSingle();
  return data?.verified_at && data.youtube_channel_id
    ? [key, `youtube:${data.youtube_channel_id}`]
    : [key];
}

async function stickyVoice(
  channelId: string,
  keys: string[]
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("tts_requests")
    .select("voice")
    .eq("channel_id", channelId)
    .in("participant_key", keys)
    .not("voice", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
  }
  const stored = data?.voice ? resolveVoiceName(data.voice) : null;
  return stored ?? seedVoice(keys);
}

function ttsMention(ctx: CommandContext): string {
  return `@${(ctx.message.authorName ?? ctx.message.author).replace(/^@+/, "")}`;
}

export async function voicesHandler(ctx: CommandContext): Promise<void> {
  const keys = await identityKeys(ctx);
  const mine = await stickyVoice(ctx.stream.channelId, keys);
  ctx.reply(
    `${ttsMention(ctx)} voices: ${Object.keys(TTS_VOICES).join(", ")} — yours is ${mine}. Change it with !tts <voice> your message.`
  );
}

export async function ttsHandler(ctx: CommandContext): Promise<void> {
  const { voice: picked, text } = splitVoiceToken(ctx.args);
  const mention = ttsMention(ctx);
  if (!text) {
    ctx.reply(
      `${mention} usage: !tts <voice> your message (max ${MAX_TTS_CHARS} characters) — voices: ${Object.keys(TTS_VOICES).join(", ")}`
    );
    return;
  }
  if (text.length > MAX_TTS_CHARS) {
    ctx.reply(
      `${mention} that's ${text.length} characters — TTS messages max out at ${MAX_TTS_CHARS}.`
    );
    return;
  }

  const keys = await identityKeys(ctx);
  const voice = picked ?? (await stickyVoice(ctx.stream.channelId, keys));
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
    participant_key: keys[0],
    origin: ctx.message.origin === "vidstube" ? "vidstube" : "youtube",
    author_name: ctx.message.authorName ?? ctx.message.author,
    text,
    voice,
    status,
    reason: verdict.reason || null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("tts request insert failed:", error);
    return;
  }

  if (status === "approved") {
    ctx.reply(
      `${mention} queued in the ${voice} voice — your message will be spoken on stream.`
    );
  } else if (status === "suggested") {
    ctx.reply(`${mention} sent to the streamer for approval (${voice} voice).`);
  }
}

type FetchLike = typeof fetch;

export async function synthesizeTts(
  text: string,
  voice: TtsVoiceSettings = DEFAULT_TTS_VOICE,
  fetchImpl: FetchLike = fetch,
  voiceName: string | null = null
): Promise<ArrayBuffer | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.error("ELEVENLABS_API_KEY is not set — TTS synthesis is skipped");
    }
    return null;
  }
  const voiceId =
    (voiceName ? TTS_VOICES[voiceName] : null) ??
    process.env.ELEVENLABS_VOICE_ID ??
    ELEVENLABS_DEFAULT_VOICE;
  const res = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: ensureTerminalPunctuation(text),
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: voice.stability,
          similarity_boost: voice.similarity,
        },
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
    .select("id, text, voice")
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .is("audio_path", null)
    .order("approved_at", { ascending: true })
    .limit(5);
  if (error) {
    console.error(error);
    return;
  }
  if (!pending?.length) {
    return;
  }
  const { data: scoring } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("tts_stability, tts_similarity")
    .eq("stream_id", streamId)
    .maybeSingle();
  const voice: TtsVoiceSettings = {
    stability: scoring?.tts_stability ?? DEFAULT_TTS_VOICE.stability,
    similarity: scoring?.tts_similarity ?? DEFAULT_TTS_VOICE.similarity,
  };
  for (const row of pending) {
    const audio = await synthesizeTts(row.text, voice, fetch, row.voice);
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
