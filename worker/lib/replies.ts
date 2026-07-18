const NIGHTBOT_SEND_URL = "https://api.nightbot.tv/1/channel/send";
const MAX_YOUTUBE_CHARS = 400;

export type ReplyDelivery = {
  streamId: string;
  origin: "vidstube" | "youtube" | "bot";
  text: string;
};

export function truncateForYoutube(text: string): string {
  if (text.length <= MAX_YOUTUBE_CHARS) {
    return text;
  }
  const slice = text.slice(0, MAX_YOUTUBE_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > MAX_YOUTUBE_CHARS / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

function sendSpacingMs(): number {
  const raw = Number(process.env.NIGHTBOT_SEND_SPACING_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 5200;
}

type NightbotSender = (text: string) => Promise<Response>;

const defaultSender: NightbotSender = (text) =>
  fetch(NIGHTBOT_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NIGHTBOT_CHANNEL_SEND_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ message: text }).toString(),
  });

const queue: string[] = [];
let draining = false;
let warnedMissingToken = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function drainQueue(sender: NightbotSender, wait: typeof sleep) {
  if (draining) {
    return;
  }
  draining = true;
  try {
    while (queue.length) {
      const text = queue.shift()!;
      try {
        const res = await sender(text);
        if (res.status === 429) {
          await wait(sendSpacingMs());
          const retry = await sender(text);
          if (!retry.ok) {
            console.error(
              `nightbot send retry failed (${retry.status}): ${await retry.text()}`
            );
          }
        } else if (!res.ok) {
          console.error(
            `nightbot send failed (${res.status}): ${await res.text()}`
          );
        }
      } catch (e) {
        console.error("nightbot send error:", e);
      }
      if (queue.length) {
        await wait(sendSpacingMs());
      }
    }
  } finally {
    draining = false;
  }
}

export function enqueueNightbotSend(
  text: string,
  sender: NightbotSender = defaultSender,
  wait: typeof sleep = sleep
): void {
  if (!process.env.NIGHTBOT_CHANNEL_SEND_TOKEN) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      console.error(
        "NIGHTBOT_CHANNEL_SEND_TOKEN is not set — skipping YouTube replies"
      );
    }
    return;
  }
  queue.push(truncateForYoutube(text));
  void drainQueue(sender, wait);
}

export async function deliverReply(delivery: ReplyDelivery): Promise<void> {
  if (delivery.origin === "youtube") {
    enqueueNightbotSend(delivery.text);
    return;
  }
  // Imported lazily so pure helpers (truncation, queue) stay testable without
  // Supabase env configured.
  const { supabaseAdmin } = await import("../supabase");
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    stream_id: delivery.streamId,
    origin: "bot",
    user_id: null,
    author_name: "VidsBot",
    body: delivery.text,
  });
  if (error) {
    console.error("vidsbot reply insert failed:", error);
  }
}
